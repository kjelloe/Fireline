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
import { worldToCellFloor } from "../shared/fixedmath.js";

export const AI_OPERATOR_FIRST = 16;
export const AI_OPERATOR_COUNT = 8;

// One AI regent is permanently paired with each initial field asset. This keeps
// identity and decisions stable for replays, server restarts, and test harnesses.
const AGENTS = Object.freeze([
  { operatorId: 16, assetId: 0, team: 0 },
  { operatorId: 17, assetId: 1, team: 0 },
  { operatorId: 18, assetId: 2, team: 0 },
  { operatorId: 19, assetId: 3, team: 0 },
  { operatorId: 20, assetId: 4, team: 1 },
  { operatorId: 21, assetId: 5, team: 1 },
  { operatorId: 22, assetId: 6, team: 1 },
  { operatorId: 23, assetId: 7, team: 1 },
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

export class AIRegency {
  constructor(options = {}) {
    this.fixedAgents = options.fixedAgents === false ? [] : AGENTS;
    this.regented = new Set(); // human operator slots under takeover (3C)
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

    for (const [operatorId, agent] of [...controlled.entries()].sort((a, b) => a[0] - b[0])) {
      const operator = state.operators[operatorId];
      if (operator.state !== OP_ACTIVE || operator.assetId === -1) continue;
      const asset = state.assets[operator.assetId];
      // The AI never evicts humans or drives assets it does not operate.
      if (!asset || asset.operatorId !== operatorId || isWreck(asset)) continue;

      // Fire doctrine: engage the nearest visible enemy in range when able.
      if (asset.ammo > 0 && inSupply(state, asset)) {
        const target = pickFireTarget(state, asset, visibleByTeam[asset.team]);
        if (target) {
          commands.push({ type: CMD_FIRE_ORDER, operatorId, targetAssetId: target.id });
          continue;
        }
      }

      // Movement doctrine: fixed agents patrol; regented assets push for the
      // nearest relay their team does not own, else hold position.
      if (asset.state !== ASSET_IDLE) continue;
      let target = null;
      if (agent) {
        target = patrolTarget(agent, state.tick);
      } else {
        const relay = nearestUnownedRelay(state, asset);
        if (relay) target = [relay.cellX, relay.cellY];
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
