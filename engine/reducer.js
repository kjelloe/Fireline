// engine/reducer.js
// Pure deterministic apply(state, command) -> nextState.
// Never mutates input state. Returns a new state object.
// All branching is deterministic; no Date, Math.random, or I/O.

import { cloneState, MAX_OPERATORS, MAX_ASSETS, CELL_SCALE,
         OP_ABSENT, OP_ACTIVE, OP_DOWN,
         ASSET_IDLE, ASSET_MOVING, ASSET_DISABLED, ASSET_SALVAGED } from "./state.js";
import { validate,
         CMD_ADVANCE_TICK, CMD_JOIN_OPERATOR, CMD_SELECT_ASSET,
         CMD_MOVE_ORDER, CMD_CALL_MEDIC, CMD_RESPAWN } from "./commands.js";

const MOVE_SPEED   = 16;   // fixed-point units per tick (at 10 Hz ≈ 0.625 cells/s)
const DOWN_TIMER   = 100;  // ticks before auto-respawn (10 s at 10 Hz)
const RESPAWN_WAIT = 10;   // ticks for manual early respawn

function emit(state, event) { state.events.push(event); }

function applyAdvanceTick(s) {
  s.tick += 1;

  // Advance asset movement
  for (const a of s.assets) {
    if (a.state !== ASSET_MOVING) continue;
    const dx = a.targetX - a.x;
    const dy = a.targetY - a.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist <= MOVE_SPEED) {
      a.x = a.targetX; a.y = a.targetY;
      a.state = ASSET_IDLE; a.targetX = -1; a.targetY = -1; a.moveProgress = 0;
      emit(s, { type: "asset_arrived", assetId: a.id, x: a.x, y: a.y });
    } else {
      // Manhattan step toward target
      if (Math.abs(dx) >= Math.abs(dy)) {
        a.x += dx > 0 ? MOVE_SPEED : -MOVE_SPEED;
      } else {
        a.y += dy > 0 ? MOVE_SPEED : -MOVE_SPEED;
      }
      a.moveProgress = Math.min(255, a.moveProgress + 4);
    }
  }

  // Advance operator down timers
  for (const o of s.operators) {
    if (o.state !== OP_DOWN) continue;
    o.downTimer -= 1;
    if (o.downTimer <= 0) {
      o.state = OP_ACTIVE; o.downTimer = 0;
      emit(s, { type: "operator_respawned", operatorId: o.id });
    }
  }
}

function applyJoinOperator(s, cmd) {
  const o = s.operators[cmd.operatorId];
  if (o.state !== OP_ABSENT) {
    emit(s, { type: "rejected", cmd: cmd.type, reason: "operator already active" }); return;
  }
  o.state = OP_ACTIVE; o.team = cmd.team; o.score = 0; o.assetId = -1;
  emit(s, { type: "operator_joined", operatorId: o.id, team: o.team });
}

function applySelectAsset(s, cmd) {
  const o = s.operators[cmd.operatorId];
  if (o.state !== OP_ACTIVE) {
    emit(s, { type: "rejected", cmd: cmd.type, reason: "operator not active" }); return;
  }
  const a = s.assets[cmd.assetId];
  if (a.team !== o.team) {
    emit(s, { type: "rejected", cmd: cmd.type, reason: "asset belongs to other team" }); return;
  }
  if (a.state === ASSET_DISABLED || a.state === ASSET_SALVAGED) {
    emit(s, { type: "rejected", cmd: cmd.type, reason: "asset not available" }); return;
  }
  if (a.operatorId !== -1 && a.operatorId !== cmd.operatorId) {
    emit(s, { type: "rejected", cmd: cmd.type, reason: "asset already operated" }); return;
  }
  // Release previous asset
  if (o.assetId !== -1 && o.assetId !== cmd.assetId) {
    s.assets[o.assetId].operatorId = -1;
  }
  o.assetId = a.id; a.operatorId = o.id;
  emit(s, { type: "asset_selected", operatorId: o.id, assetId: a.id });
}

function applyMoveOrder(s, cmd) {
  const o = s.operators[cmd.operatorId];
  if (o.state !== OP_ACTIVE || o.assetId === -1) {
    emit(s, { type: "rejected", cmd: cmd.type, reason: "no active asset" }); return;
  }
  const a = s.assets[o.assetId];
  if (a.state === ASSET_DISABLED || a.state === ASSET_SALVAGED) {
    emit(s, { type: "rejected", cmd: cmd.type, reason: "asset not operable" }); return;
  }
  a.targetX = (cmd.targetCellX * CELL_SCALE) >>> 0;
  a.targetY = (cmd.targetCellY * CELL_SCALE) >>> 0;
  a.state = ASSET_MOVING;
  emit(s, { type: "move_ordered", assetId: a.id, targetX: a.targetX, targetY: a.targetY });
}

function applyCallMedic(s, cmd) {
  const o = s.operators[cmd.operatorId];
  if (o.state !== OP_DOWN) {
    emit(s, { type: "rejected", cmd: cmd.type, reason: "operator not down" }); return;
  }
  emit(s, { type: "medic_called", operatorId: o.id });
}

function applyRespawn(s, cmd) {
  const o = s.operators[cmd.operatorId];
  if (o.state !== OP_DOWN) {
    emit(s, { type: "rejected", cmd: cmd.type, reason: "operator not down" }); return;
  }
  if (o.downTimer > DOWN_TIMER - RESPAWN_WAIT) {
    emit(s, { type: "rejected", cmd: cmd.type, reason: "respawn not yet available" }); return;
  }
  o.state = OP_ACTIVE; o.downTimer = 0;
  emit(s, { type: "operator_respawned", operatorId: o.id });
}

export function apply(state, command) {
  const v = validate(command);
  if (!v.ok) {
    const next = cloneState(state);
    emit(next, { type: "rejected", cmd: command?.type, reason: v.reason });
    return next;
  }
  const next = cloneState(state);
  switch (command.type) {
    case CMD_ADVANCE_TICK:   applyAdvanceTick(next);          break;
    case CMD_JOIN_OPERATOR:  applyJoinOperator(next, command); break;
    case CMD_SELECT_ASSET:   applySelectAsset(next, command);  break;
    case CMD_MOVE_ORDER:     applyMoveOrder(next, command);    break;
    case CMD_CALL_MEDIC:     applyCallMedic(next, command);    break;
    case CMD_RESPAWN:        applyRespawn(next, command);      break;
  }
  return next;
}
