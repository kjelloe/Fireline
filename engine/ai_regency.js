// engine/ai_regency.js — deterministic AI Regency (1D fixed agents + 3C).
// Generates ordinary reducer commands; never touches state directly and uses
// neither wall-clock time nor randomness. Humans always resolve first in a
// tick. 3C adds: a fire doctrine (nearest team-visible enemy in range, only
// while in supply), and regency takeover of human operator slots whose
// connection dropped (the war keeps moving without them).

import {
  OP_ABSENT, OP_ACTIVE, ASSET_IDLE, ASSET_DISABLED, ASSET_SALVAGED,
} from "./state.js";
import {
  CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER, CMD_FIRE_ORDER,
  CMD_TOW_ORDER, CMD_DEPLOY_MINE, CMD_CLEAR_MINE, CMD_PING,
} from "./commands.js";
import { mineAt, MINE_CLEAR_RADIUS_CELLS } from "./mines.js";
import { PING_COOLDOWN_TICKS } from "./pings.js";
import { computeVisible } from "./los.js";
import { inFireRange } from "./combat.js";
import { inSupply } from "./supply.js";
import { getUnitStats } from "./units.js";
import { STD_AT_BASE, STD_CARRIED, STD_DROPPED } from "./standards.js";
import { CMD_REDEPLOY } from "./commands.js";
import { downedFor, REDEPLOY_TICKS } from "./downed.js";
import { towRejection, towedWreck } from "./recovery.js";
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
// 11C: exact mirrors (x' = 127-x), each crossing its team's mid relay.
const TEAM_A_PATROL = Object.freeze([[48, 56], [60, 56], [58, 63], [56, 70]]);
const TEAM_B_PATROL = Object.freeze([[79, 56], [67, 56], [69, 63], [71, 70]]);

function patrolTarget(agent, tick) {
  const patrol = agent.team === 0 ? TEAM_A_PATROL : TEAM_B_PATROL;
  const phase = ((tick / 80) | 0) + (agent.assetId & 3);
  return patrol[phase % patrol.length];
}

function homeCellFor(state, team) {
  const base = state.bases.find((b) => b.team === team);
  if (!base) return null;
  return [base.x + ((base.width / 2) | 0), base.y + ((base.height / 2) | 0)];
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
  // Q2d (prompt 16): an enemy CARRYING a standard is the priority target —
  // the ruled counter to the mutual-carry standoff. Rank: carrier-of-standard
  // first, then nearest, ties on lowest id.
  const carryingIds = new Set(
    state.standards.filter((st) => st.carrierAssetId !== -1).map((st) => st.carrierAssetId)
  );
  let bestCarries = false;
  for (const enemy of state.assets) {
    if (enemy.team === asset.team || isWreck(enemy)) continue;
    if (!visibleSet.has(enemy.id)) continue;
    if (!inFireRange(asset, enemy)) continue;
    const carries = carryingIds.has(enemy.id);
    const dx = enemy.x - asset.x;
    const dy = enemy.y - asset.y;
    const key = dx * dx + dy * dy;
    const better =
      best === null ||
      (carries && !bestCarries) ||
      (carries === bestCarries && (key < bestKey || (key === bestKey && enemy.id < best.id)));
    if (better) {
      best = enemy;
      bestKey = key;
      bestCarries = carries;
    }
  }
  return best;
}

// 11C: how far off-plan an agent will divert to flip a nearby relay.
export const CAPTURE_SEEK_CELLS = 16;

// 11D (Q11): tanks fortify ground this close to an owned relay (never the
// site cell itself — that's protected); trucks clear marked mines they pass.
export const MINE_FORTIFY_CELLS = 3;
// 11D (Q16): regents signal sparingly — one ping per seat per 30 s.
export const AI_PING_INTERVAL_TICKS = 300;

// 11E (Q5): how far a truck/carrier will divert for a rescue errand.
export const RESCUE_SEEK_CELLS = 24;

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
        commands.push({ type: CMD_SELECT_ASSET, operatorId: agent.operatorId, assetId: agent.assetId, confirm: true });
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

    // 11C capture-seek roles: ONE designated capturer per (team, unowned
    // relay) — the nearest controlled operable asset, ties on lowest
    // operator id. Sim-verified: letting everyone divert piled both teams
    // onto one contested flag where nobody could fire (out of supply) and
    // four of five seeds froze at 0-0.
    const capturerFor = new Map(); // `${team}:${siteId}` -> operatorId
    for (const site of state.sites) {
      for (const team of [0, 1]) {
        if (site.owner === team) continue;
        let bestOp = -1;
        let bestDist = Infinity;
        for (const [operatorId] of [...controlled.entries()].sort((a, b) => a[0] - b[0])) {
          const op = state.operators[operatorId];
          if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
          const a = state.assets[op.assetId];
          if (!a || a.team !== team || a.operatorId !== operatorId || isWreck(a)) continue;
          const dist = Math.abs(site.cellX - worldToCellFloor(a.x)) +
                       Math.abs(site.cellY - worldToCellFloor(a.y));
          if (dist < bestDist) {
            bestDist = dist;
            bestOp = operatorId;
          }
        }
        if (bestOp !== -1 && bestDist <= CAPTURE_SEEK_CELLS) {
          capturerFor.set(`${team}:${site.id}`, bestOp);
        }
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
        const team = operator.team;
        // Q1 (prompt 16): "AI may crew free assets when a ROLE is unfilled."
        // TEAM-wide check (a human raiding fills the role too): no crewed
        // operable carrier anywhere on the team → ANY free AI seat grabs a
        // spare carrier before its default pick.
        const carrierCrewed = state.assets.some((a) =>
          a.team === team && a.operatorId !== -1 && !isWreck(a) &&
          getUnitStats(a.type).canCarryStandard);
        const roleCarrier = !carrierCrewed
          ? state.assets.find((a) =>
              a.team === team && a.operatorId === -1 && !isWreck(a) &&
              getUnitStats(a.type).canCarryStandard)
          : null;
        if (roleCarrier) {
          pick = roleCarrier.id;
        } else if (agent) {
          const paired = state.assets[agent.assetId];
          if (paired && paired.operatorId === -1 && !isWreck(paired)) pick = paired.id;
        } else {
          const free = state.assets.find((a) =>
            a.team === team &&
            a.operatorId === -1 && !isWreck(a));
          if (free) pick = free.id;
        }
        if (pick !== null) {
          commands.push({ type: CMD_SELECT_ASSET, operatorId, assetId: pick, confirm: true });
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
        // Q14 (prompt 16): a drone stinging THIS asset gets swatted first —
        // cheap shot, ends the pestering. Indirect tubes can't track it.
        if (!getUnitStats(asset.type).indirect) {
          const pest = state.drones.find(
            (d) => d.targetAssetId === asset.id && inFireRange(asset, d)
          );
          if (pest) {
            commands.push({ type: CMD_FIRE_ORDER, operatorId, targetDroneId: pest.id });
            continue;
          }
        }
        const target = pickFireTarget(state, asset, visibleByTeam[asset.team]);
        if (target) {
          commands.push({ type: CMD_FIRE_ORDER, operatorId, targetAssetId: target.id });
          continue;
        }
      }

      // 11D alive-world doctrine (Q11/Q16) — the world acts even with one
      // human present. All state-driven and deterministic.
      const cellX0 = worldToCellFloor(asset.x);
      const cellY0 = worldToCellFloor(asset.y);
      const stats = getUnitStats(asset.type);
      // Trucks defuse marked enemy mines they stand next to.
      if (stats.canClearMines) {
        const mine = state.mines.find((m) =>
          m.team !== asset.team && m.marked === 1 &&
          Math.max(Math.abs(m.cellX - cellX0), Math.abs(m.cellY - cellY0)) <= MINE_CLEAR_RADIUS_CELLS);
        if (mine) {
          commands.push({ type: CMD_CLEAR_MINE, operatorId, mineId: mine.id });
          continue;
        }
      }
      // Tanks fortify: idle near an owned relay (off the protected site
      // cell, outside bases), rack loaded, ground clean -> lay a mine.
      if (stats.canMine && asset.minesLeft > 0 && asset.state === ASSET_IDLE) {
        const nearOwned = state.sites.some((site) =>
          site.owner === asset.team &&
          !(site.cellX === cellX0 && site.cellY === cellY0) &&
          Math.max(Math.abs(site.cellX - cellX0), Math.abs(site.cellY - cellY0)) <= MINE_FORTIFY_CELLS);
        const inAnyBase = state.bases.some((b) =>
          cellX0 >= b.x && cellX0 < b.x + b.width && cellY0 >= b.y && cellY0 < b.y + b.height);
        if (nearOwned && !inAnyBase && !mineAt(state, cellX0, cellY0)) {
          commands.push({ type: CMD_DEPLOY_MINE, operatorId });
          continue;
        }
        // Standing ON the site it just captured: step one cell south to
        // legal ground so the fortify rule can fire next tick.
        const onOwnSite = state.sites.some((site) =>
          site.owner === asset.team && site.cellX === cellX0 && site.cellY === cellY0);
        if (onOwnSite) {
          commands.push({
            type: CMD_MOVE_ORDER, operatorId, targetCellX: cellX0, targetCellY: cellY0 + 1,
          });
          continue;
        }
      }
      // Regents ping, sparingly (Q16): the raider calls for escort while
      // carrying; the recoverer announces its run; scouts flag marked mines.
      if (state.tick - operator.lastPingTick >= AI_PING_INTERVAL_TICKS) {
        let ping = null;
        if (state.standards.length === 2) {
          const enemyStd = state.standards[asset.team === 0 ? 1 : 0];
          const ownStd = state.standards[asset.team];
          if (enemyStd.status === STD_CARRIED && enemyStd.carrierAssetId === asset.id) {
            ping = { kind: "need_escort" };
          } else if (ownStd.status === STD_DROPPED && operatorId === recovererFor[asset.team]) {
            ping = {
              kind: "recovery_in_progress",
              targetCellX: worldToCellFloor(ownStd.x), targetCellY: worldToCellFloor(ownStd.y),
            };
          }
        }
        if (!ping && asset.type === 1) {
          const marked = state.mines.find((m) =>
            m.team !== asset.team && m.marked === 1 &&
            Math.max(Math.abs(m.cellX - cellX0), Math.abs(m.cellY - cellY0)) <= 8);
          if (marked) {
            ping = { kind: "mines_detected", targetCellX: marked.cellX, targetCellY: marked.cellY };
          }
        }
        if (ping) {
          commands.push({ type: CMD_PING, operatorId, ...ping });
          // pinging is free: fall through to movement in the same tick
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
      // 11E full AI rescue play (Q5). Trucks: hook the nearest claimable
      // wreck, haul it home (the repair bay takes it from there). Carriers:
      // ferry aboard passengers home; otherwise fetch a walking downed
      // teammate nearby — unless this carrier is the team's raider on duty.
      if (!target && stats.canTow) {
        const inTow = towedWreck(state, asset.id);
        if (inTow) {
          target = homeCellFor(state, asset.team);
        } else {
          let wreck = null;
          let bestDist = Infinity;
          for (const w of state.assets) {
            if (w.team !== asset.team || !isWreck(w)) continue;
            if (w.towedBy !== -1 || w.recoverTimer > 0) continue;
            const d = Math.max(Math.abs(worldToCellFloor(w.x) - cellX0),
                               Math.abs(worldToCellFloor(w.y) - cellY0));
            if (d < bestDist) { bestDist = d; wreck = w; }
          }
          if (wreck && bestDist <= RESCUE_SEEK_CELLS) {
            if (towRejection(state, asset, wreck) === null) {
              commands.push({ type: CMD_TOW_ORDER, operatorId, wreckAssetId: wreck.id });
              continue;
            }
            target = [worldToCellFloor(wreck.x), worldToCellFloor(wreck.y)];
          }
        }
      }
      if (!target && stats.capacity > 0) {
        if (asset.aboard1 !== -1 || asset.aboard2 !== -1) {
          target = homeCellFor(state, asset.team); // deliver at base idle
        } else if (asset.id !== raiderFor[asset.team]) {
          let body = null;
          let bestDist = Infinity;
          for (const d of state.downed) {
            if (d.team !== asset.team) continue;
            const dist = Math.max(Math.abs(worldToCellFloor(d.x) - cellX0),
                                  Math.abs(worldToCellFloor(d.y) - cellY0));
            if (dist < bestDist) { bestDist = dist; body = d; }
          }
          if (body && bestDist <= RESCUE_SEEK_CELLS) {
            target = [worldToCellFloor(body.x), worldToCellFloor(body.y)];
          }
        }
      }

      // 11C capture-seek (11B consequence): the countdown killed drive-by
      // captures. The designated capturer diverts to its relay and stands
      // on it (standing on the target cell issues no move — the dwell IS
      // the capture). It won't stare down an enemy-held flag it cannot
      // shoot at (out of supply): that froze whole wars at 0-0.
      if (!target) {
        const relay = nearestUnownedRelay(state, asset);
        if (relay && capturerFor.get(`${asset.team}:${relay.id}`) === operatorId) {
          const enemyOnFlag = state.assets.some((e) =>
            e.team !== asset.team && !isWreck(e) &&
            worldToCellFloor(e.x) === relay.cellX && worldToCellFloor(e.y) === relay.cellY);
          if (!enemyOnFlag || inSupply(state, asset)) {
            target = [relay.cellX, relay.cellY];
          }
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
