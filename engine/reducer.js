// engine/reducer.js — the authoritative pure reducer: apply(state, command).
// Reconstructed 1E contract (see test/fixtures/1A_reducer.json) with the 1F
// terrain-speed rules merged in. Never mutates input state. Integer math only.
// Events describe what this command did; rejected in-game actions emit a
// "rejected" event and change nothing else.

import {
  OP_ABSENT, OP_ACTIVE,
  ASSET_IDLE, ASSET_MOVING, ASSET_DISABLED, ASSET_SALVAGED,
} from "./state.js";
import {
  CMD_ADVANCE_TICK, CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER,
  CMD_FIRE_ORDER, CMD_CALL_MEDIC, CMD_RESPAWN, validate,
} from "./commands.js";
import { resolveShot, inFireRange, SUPPRESSION_TICKS } from "./combat.js";
import { captureCheck } from "./sites.js";
import { SUPPLY_FIRE_COST, SUPPLY_MOVE_COST, resupplyAt, inSupply } from "./supply.js";
import { getUnitStats } from "./units.js";
import { computeVisible, sensorRadius, chebyshevCells } from "./los.js";
import {
  checkVictory, dominatingTeam, PHASE_RUNNING, PHASE_OVER,
} from "./victory.js";

// Scoring (3E): what a capture or a kill is worth on the war clock scoreboard.
export const SCORE_CAPTURE = 10;
export const SCORE_DISABLE = 5;
import { speedMultiplier } from "./terrain.js";
import { cellToWorld, worldToCellFloor, absI32, floorDivI32 } from "../shared/fixedmath.js";

export { createInitialState } from "./state.js";

// Tank movement speed in fixed world units per tick before terrain multiplier.
// Kept as the historical export name; per-unit speeds come from units.js (3A).
export const BASE_SPEED = 16;

function copyState(state) {
  return {
    ...state,
    teamScores: [...state.teamScores],
    operators: state.operators.map((o) => ({ ...o })),
    assets: state.assets.map((a) => ({ ...a })),
    sites: state.sites.map((s) => ({ ...s })),
    events: [],
  };
}

function reject(next, command, reason) {
  next.events.push({ type: "rejected", cmd: command.type, reason });
  return next;
}

function applyJoinOperator(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ABSENT) return reject(next, command, "operator already active");
  operator.state = OP_ACTIVE;
  operator.team = command.team;
  next.events.push({ type: "operator_joined", operatorId: operator.id, team: operator.team });
  return next;
}

function applySelectAsset(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return reject(next, command, "operator not active");
  const asset = next.assets[command.assetId];
  if (!asset) return reject(next, command, "no such asset");
  if (asset.team !== operator.team) return reject(next, command, "asset belongs to other team");
  if (asset.operatorId !== -1 && asset.operatorId !== operator.id) {
    return reject(next, command, "asset already operated");
  }
  if (operator.assetId !== -1 && operator.assetId !== asset.id) {
    const previous = next.assets[operator.assetId];
    if (previous && previous.operatorId === operator.id) previous.operatorId = -1;
  }
  operator.assetId = asset.id;
  asset.operatorId = operator.id;
  next.events.push({ type: "asset_selected", operatorId: operator.id, assetId: asset.id });
  return next;
}

function applyMoveOrder(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return reject(next, command, "operator not active");
  if (operator.assetId === -1) return reject(next, command, "no asset selected");
  const asset = next.assets[operator.assetId];
  if (!asset || asset.operatorId !== operator.id) return reject(next, command, "no asset selected");
  if (asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  asset.targetX = cellToWorld(command.targetCellX);
  asset.targetY = cellToWorld(command.targetCellY);
  asset.state = ASSET_MOVING;
  next.events.push({
    type: "move_ordered", assetId: asset.id, targetX: asset.targetX, targetY: asset.targetY,
  });
  return next;
}

function applyFireOrder(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return reject(next, command, "operator not active");
  if (operator.assetId === -1) return reject(next, command, "no asset selected");
  const attacker = next.assets[operator.assetId];
  if (!attacker || attacker.operatorId !== operator.id) {
    return reject(next, command, "no asset selected");
  }
  if (attacker.state === ASSET_DISABLED || attacker.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  const target = next.assets[command.targetAssetId];
  if (!target) return reject(next, command, "no such target");
  if (target.team === attacker.team) return reject(next, command, "friendly target");
  if (target.state === ASSET_DISABLED || target.state === ASSET_SALVAGED) {
    return reject(next, command, "target not operable");
  }
  if (attacker.ammo < SUPPLY_FIRE_COST) return reject(next, command, "out of ammo");
  if (!inSupply(next, attacker)) return reject(next, command, "out of supply");
  if (!inFireRange(attacker, target)) return reject(next, command, "target out of range");
  // 3D: shots need the target spotted by the team; direct-fire chassis also
  // need it inside their own sensor radius. Indirect (artillery) fires on any
  // team-spotted target — the spotter doctrine.
  if (!computeVisible(next, attacker.team).has(target.id)) {
    return reject(next, command, "target not spotted");
  }
  if (!getUnitStats(attacker.type).indirect &&
      chebyshevCells(attacker, target) > sensorRadius(attacker)) {
    return reject(next, command, "no line of sight");
  }

  attacker.ammo -= SUPPLY_FIRE_COST;
  const shot = resolveShot(attacker, target);
  target.hp = Math.max(0, target.hp - shot.hpDelta);
  if (shot.suppressed && target.hp > 0) target.suppressedTimer = SUPPRESSION_TICKS;
  next.events.push({
    type: "fire_resolved",
    attackerId: attacker.id,
    targetId: target.id,
    hpDelta: shot.hpDelta,
    targetHp: target.hp,
  });
  if (target.hp === 0) {
    target.state = ASSET_DISABLED;
    next.teamScores[attacker.team] += SCORE_DISABLE;
    next.events.push({ type: "asset_disabled", assetId: target.id });
  }
  return next;
}

function stepAsset(asset, map, supplied) {
  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  if (cellX < 0 || cellX >= map.width || cellY < 0 || cellY >= map.height) return;

  const terrain = map.cells[cellY * map.width + cellX];
  let step = floorDivI32(getUnitStats(asset.type).speed * speedMultiplier(terrain), 256);
  if (!supplied) step = floorDivI32(step, 2); // out of supply: half speed (3B)
  if (step <= 0) return;

  const dx = asset.targetX - asset.x;
  const dy = asset.targetY - asset.y;
  let remaining = step;

  // Axis-major movement: spend the step on the larger displacement first.
  if (absI32(dx) >= absI32(dy)) {
    const mx = Math.min(absI32(dx), remaining);
    asset.x += dx < 0 ? -mx : mx;
    remaining -= mx;
    const my = Math.min(absI32(dy), remaining);
    asset.y += dy < 0 ? -my : my;
  } else {
    const my = Math.min(absI32(dy), remaining);
    asset.y += dy < 0 ? -my : my;
    remaining -= my;
    const mx = Math.min(absI32(dx), remaining);
    asset.x += dx < 0 ? -mx : mx;
  }

  if (asset.x === asset.targetX && asset.y === asset.targetY) {
    asset.state = ASSET_IDLE;
  }
}

function applyAdvanceTick(next) {
  next.tick += 1;
  // A finished war only counts time; nothing moves, fights, or captures.
  if (next.phase === PHASE_OVER) return next;
  for (const asset of next.assets) {
    if (asset.suppressedTimer > 0) asset.suppressedTimer -= 1;
    if (asset.state !== ASSET_MOVING) continue;
    if (asset.fuel < SUPPLY_MOVE_COST) continue; // stranded until resupplied
    const beforeX = asset.x;
    const beforeY = asset.y;
    stepAsset(asset, next.map, inSupply(next, asset));
    if (asset.x !== beforeX || asset.y !== beforeY) asset.fuel -= SUPPLY_MOVE_COST;
  }
  // Capture pass: stable asset order decides same-tick contests.
  for (const asset of next.assets) {
    const site = captureCheck(next, asset.id);
    if (site && site.owner !== asset.team) {
      site.owner = asset.team;
      next.teamScores[asset.team] += SCORE_CAPTURE;
      next.events.push({ type: "site_captured", siteId: site.id, team: asset.team });
    }
  }
  // Resupply pass: standing in your own base restores ammo and fuel.
  for (const asset of next.assets) {
    const restored = resupplyAt(next, asset.id);
    if (restored) {
      asset.ammo = restored.ammo;
      asset.fuel = restored.fuel;
      next.events.push({ type: "resupplied", assetId: asset.id });
    }
  }
  // Victory pass (3E): track domination hold, then check every condition.
  const dominator = dominatingTeam(next);
  if (dominator === -1) {
    next.dominationTeam = -1;
    next.dominationTicks = 0;
  } else if (dominator === next.dominationTeam) {
    next.dominationTicks += 1;
  } else {
    next.dominationTeam = dominator;
    next.dominationTicks = 1;
  }
  const verdict = checkVictory(next);
  if (verdict) {
    next.phase = PHASE_OVER;
    next.winner = verdict.winner;
    next.winReason = verdict.reason;
    next.events.push({ type: "game_over", winner: verdict.winner, reason: verdict.reason });
  }
  return next;
}

export function apply(state, command) {
  const next = copyState(state);
  const verdict = validate(command);
  if (!verdict.ok) {
    next.events.push({ type: "rejected", cmd: command?.type ?? "?", reason: verdict.reason });
    return next;
  }

  if (next.phase === PHASE_OVER && command.type !== CMD_ADVANCE_TICK) {
    return reject(next, command, "war is over");
  }

  switch (command.type) {
    case CMD_ADVANCE_TICK: return applyAdvanceTick(next);
    case CMD_JOIN_OPERATOR: return applyJoinOperator(next, command);
    case CMD_SELECT_ASSET: return applySelectAsset(next, command);
    case CMD_MOVE_ORDER: return applyMoveOrder(next, command);
    case CMD_FIRE_ORDER: return applyFireOrder(next, command);
    case CMD_CALL_MEDIC: // recognized but inert until the medic milestone
    case CMD_RESPAWN:
      return next;
    default:
      return reject(next, command, `unknown command type: ${command.type}`);
  }
}
