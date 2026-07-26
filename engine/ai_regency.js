// engine/ai_regency.js — deterministic AI Regency (1D fixed agents + 3C).
// Generates ordinary reducer commands; never touches state directly and uses
// neither wall-clock time nor randomness. Humans always resolve first in a
// tick. 3C adds: a fire doctrine (nearest team-visible enemy in range, only
// while in supply), and regency takeover of human operator slots whose
// connection dropped (the war keeps moving without them).

import {
  OP_ABSENT, OP_ACTIVE, ASSET_IDLE, ASSET_DISABLED, ASSET_SALVAGED,
} from "./state.js";
import { CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER, CMD_FIRE_ORDER } from "./commands.js";
import { computeVisible } from "./los.js";
import { inFireRange } from "./combat.js";
import { inSupply } from "./supply.js";
import { getUnitStats } from "./units.js";
import { STD_AT_BASE, STD_CARRIED, STD_DROPPED } from "./standards.js";
import { CMD_REDEPLOY } from "./commands.js";
import { downedFor, REDEPLOY_TICKS } from "./downed.js";
import { OP_DOWN } from "./state.js";
import { worldToCellFloor } from "../shared/fixedmath.js";

// Objective doctrine: since 9A only Command Carriers can take the enemy
// standard, the raider role goes to the first controlled operable carrier.

export const AI_OPERATOR_FIRST = 16;
export const AI_OPERATOR_COUNT = 16;

// One AI regent is permanently paired with a field asset. Operators 16-23 keep
// their original pairing with assets 0-7 (pinned by 1D); operators 24-27 crew
// team A reserves 8-11 and 28-31 crew team B reserves 20-23. The remaining
// reserves are garage stock for humans and regency takeovers.
const AGENTS = Object.freeze([
  { operatorId: 16, assetId: 0, team: 0 },
  { operatorId: 17, assetId: 1, team: 0 },
  { operatorId: 18, assetId: 2, team: 0 },
  { operatorId: 19, assetId: 3, team: 0 },
  { operatorId: 20, assetId: 4, team: 1 },
  { operatorId: 21, assetId: 5, team: 1 },
  { operatorId: 22, assetId: 6, team: 1 },
  { operatorId: 23, assetId: 7, team: 1 },
  { operatorId: 24, assetId: 8, team: 0 },
  { operatorId: 25, assetId: 9, team: 0 },
  { operatorId: 26, assetId: 10, team: 0 },
  { operatorId: 27, assetId: 11, team: 0 },
  { operatorId: 28, assetId: 20, team: 1 },
  { operatorId: 29, assetId: 21, team: 1 },
  { operatorId: 30, assetId: 22, team: 1 },
  { operatorId: 31, assetId: 23, team: 1 },
]);

// Legible doctrine: advance from both base areas toward the corridor, then
// patrol the centre. Team B's patrol crosses the centre relay, so AI wars
// contest supply the same way humans do.
const TEAM_A_PATROL = Object.freeze([[48, 56], [60, 56], [64, 63], [56, 70]]);
const TEAM_B_PATROL = Object.freeze([[79, 56], [67, 56], [63, 63], [71, 70]]);

function patrolTarget(agent, tick) {
  const patrol = agent.team === 0 ? TEAM_A_PATROL : TEAM_B_PATROL;
  const phase = ((tick / 80) | 0) + (agent.assetId & 3);
  return patrol[phase % patrol.length];
}

function isWreck(asset) {
  return asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED;
}

function nearestUnownedRelay(state, asset) {
  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  let best = null;
  let bestDist = Infinity;
  for (const site of state.sites) {
    if (site.owner === asset.team) continue;
    const dx = Math.abs(site.cellX - cellX);
    const dy = Math.abs(site.cellY - cellY);
    const dist = dx + dy;
    if (dist < bestDist || (dist === bestDist && site.id < best?.id)) {
      best = site;
      bestDist = dist;
    }
  }
  return best;
}

function pickFireTarget(state, asset, visibleSet) {
  let best = null;
  let bestKey = null;
  for (const enemy of state.assets) {
    if (enemy.team === asset.team || isWreck(enemy)) continue;
    if (!visibleSet.has(enemy.id)) continue;
    if (!inFireRange(asset, enemy)) continue;
    const dx = enemy.x - asset.x;
    const dy = enemy.y - asset.y;
    const key = dx * dx + dy * dy;
    if (best === null || key < bestKey || (key === bestKey && enemy.id < best.id)) {
      best = enemy;
      bestKey = key;
    }
  }
  return best;
}

export const AI_EASY = 0;
export const AI_NORMAL = 1;
export const AI_HARD = 2;

export class AIRegency {
  constructor(options = {}) {
    this.fixedAgents = options.fixedAgents === false ? [] : AGENTS;
    this.regented = new Set(); // human operator slots under takeover (3C)
    // 6D: easy fires every other tick; hard swaps patrols for relay pushes.
    this.difficulty = options.difficulty ?? AI_NORMAL;
  }

  assume(operatorId) {
    this.regented.add(operatorId);
  }

  release(operatorId) {
    this.regented.delete(operatorId);
  }

  plan(state) {
    const commands = [];
    const visibleByTeam = [computeVisible(state, 0), computeVisible(state, 1)];

    // Claim fixed AI operator slots exactly once.
    for (const agent of this.fixedAgents) {
      if (state.operators[agent.operatorId].state === OP_ABSENT) {
        commands.push({ type: CMD_JOIN_OPERATOR, operatorId: agent.operatorId, team: agent.team });
        commands.push({ type: CMD_SELECT_ASSET, operatorId: agent.operatorId, assetId: agent.assetId });
      }
    }

    // Command doctrine for every AI-controlled operator, stable ascending order.
    const controlled = new Map(); // operatorId -> fixed agent | null (regented)
    for (const agent of this.fixedAgents) controlled.set(agent.operatorId, agent);
    for (const id of [...this.regented].sort((a, b) => a - b)) {
      if (!controlled.has(id)) controlled.set(id, null);
    }

    // Per-team designated roles, computed fresh every tick from live state
    // (both rules found by backend sims: a global recoverer pick left one team
    // unable to recover; a dead scout left a team unable to raid again).
    // recoverer: lowest controlled operator driving an operable team asset.
    // raider: the team scout if alive, else the highest such operator's asset.
    const recovererFor = { 0: -1, 1: -1 };
    const raiderFor = { 0: -1, 1: -1 };
    for (const [operatorId, agent] of [...controlled.entries()].sort((a, b) => a[0] - b[0])) {
      const op = state.operators[operatorId];
      if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
      const a = state.assets[op.assetId];
      if (!a || a.operatorId !== operatorId || isWreck(a)) continue;
      if (recovererFor[a.team] === -1) recovererFor[a.team] = operatorId;
      if (raiderFor[a.team] === -1 && getUnitStats(a.type).canCarryStandard) {
        raiderFor[a.team] = a.id; // first operable controlled carrier raids
      }
    }

    for (const [operatorId, agent] of [...controlled.entries()].sort((a, b) => a[0] - b[0])) {
      const operator = state.operators[operatorId];

      // 9B down-management: redeploy once the timer allows; after redeploy or
      // delivery, re-crew — fixed agents retake their paired asset when it is
      // operable and free; regented seats take the lowest free operable asset.
      if (operator.state === OP_DOWN) {
        const down = downedFor(state, operatorId);
        if (down && down.downTicks >= REDEPLOY_TICKS) {
          commands.push({ type: CMD_REDEPLOY, operatorId });
        }
        continue; // aboard a carrier or waiting out the timer
      }
      if (operator.state === OP_ACTIVE && operator.assetId === -1) {
        let pick = null;
        if (agent) {
          const paired = state.assets[agent.assetId];
          if (paired && paired.operatorId === -1 && !isWreck(paired)) pick = paired.id;
        } else {
          const free = state.assets.find((a) =>
            a.team === state.operators[operatorId].team &&
            a.operatorId === -1 && !isWreck(a));
          if (free) pick = free.id;
        }
        if (pick !== null) {
          commands.push({ type: CMD_SELECT_ASSET, operatorId, assetId: pick });
        }
        continue;
      }
      if (operator.state !== OP_ACTIVE || operator.assetId === -1) continue;
      const asset = state.assets[operator.assetId];
      // The AI never evicts humans or drives assets it does not operate.
      if (!asset || asset.operatorId !== operatorId || isWreck(asset)) continue;

      // Fire doctrine: engage the nearest visible enemy in range when the
      // gun is loaded (8E). Easy regents observe a duty cycle: they only
      // engage during the first half of every double-reload window (6D).
      const reload = getUnitStats(asset.type).reloadTicks;
      const dutyOpen = this.difficulty !== AI_EASY ||
        state.tick % (2 * reload) < reload;
      if (dutyOpen && asset.reloadTimer === 0 && asset.ammo > 0 && inSupply(state, asset)) {
        const target = pickFireTarget(state, asset, visibleByTeam[asset.team]);
        if (target) {
          commands.push({ type: CMD_FIRE_ORDER, operatorId, targetAssetId: target.id });
          continue;
        }
      }

      // Movement doctrine, in priority order:
      //   1. Standard carrier heads home to score.
      //   2. Team's lowest controlled asset recovers a dropped own standard.
      //   3. The designated raider (scout) goes for the grounded enemy standard.
      //   4. Fixed agents patrol (hard difficulty pushes relays); regented
      //      assets seek the nearest unowned relay.
      if (asset.state !== ASSET_IDLE) continue;
      let target = null;
      if (state.standards.length === 2) {
        const ownStd = state.standards[asset.team];
        const enemyStd = state.standards[asset.team === 0 ? 1 : 0];
        if (enemyStd.status === STD_CARRIED && enemyStd.carrierAssetId === asset.id) {
          target = [ownStd.homeCellX, ownStd.homeCellY]; // escort yourself home
        } else if (ownStd.status === STD_DROPPED && operatorId === recovererFor[asset.team]) {
          target = [worldToCellFloor(ownStd.x), worldToCellFloor(ownStd.y)];
        } else if (asset.id === raiderFor[asset.team] &&
                   (enemyStd.status === STD_AT_BASE || enemyStd.status === STD_DROPPED)) {
          target = [worldToCellFloor(enemyStd.x), worldToCellFloor(enemyStd.y)];
        }
      }
      if (!target && agent && this.difficulty !== AI_HARD) {
        target = patrolTarget(agent, state.tick);
      } else if (!target) {
        const relay = nearestUnownedRelay(state, asset);
        if (relay) target = [relay.cellX, relay.cellY];
        else if (agent) target = patrolTarget(agent, state.tick);
      }
      if (!target) continue;
      const currentCellX = worldToCellFloor(asset.x);
      const currentCellY = worldToCellFloor(asset.y);
      if (currentCellX !== target[0] || currentCellY !== target[1]) {
        commands.push({
          type: CMD_MOVE_ORDER, operatorId,
          targetCellX: target[0], targetCellY: target[1],
        });
      }
    }
    return commands;
  }
}
