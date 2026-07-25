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
  CMD_CALL_MEDIC, CMD_RESPAWN, validate,
} from "./commands.js";
import { speedMultiplier } from "./terrain.js";
import { cellToWorld, worldToCellFloor, absI32, floorDivI32 } from "../shared/fixedmath.js";

export { createInitialState } from "./state.js";

// Base movement speed in fixed world units per tick before terrain multiplier.
export const BASE_SPEED = 16;

function copyState(state) {
  return {
    ...state,
    teamScores: [...state.teamScores],
    operators: state.operators.map((o) => ({ ...o })),
    assets: state.assets.map((a) => ({ ...a })),
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

function stepAsset(asset, map) {
  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  if (cellX < 0 || cellX >= map.width || cellY < 0 || cellY >= map.height) return;

  const terrain = map.cells[cellY * map.width + cellX];
  const step = floorDivI32(BASE_SPEED * speedMultiplier(terrain), 256);
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
  for (const asset of next.assets) {
    if (asset.state !== ASSET_MOVING) continue;
    stepAsset(asset, next.map);
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

  switch (command.type) {
    case CMD_ADVANCE_TICK: return applyAdvanceTick(next);
    case CMD_JOIN_OPERATOR: return applyJoinOperator(next, command);
    case CMD_SELECT_ASSET: return applySelectAsset(next, command);
    case CMD_MOVE_ORDER: return applyMoveOrder(next, command);
    case CMD_CALL_MEDIC: // recognized but inert until the medic milestone
    case CMD_RESPAWN:
      return next;
    default:
      return reject(next, command, `unknown command type: ${command.type}`);
  }
}
