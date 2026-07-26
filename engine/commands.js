// engine/commands.js
// Canonical command shapes and validation.
// validate(cmd) returns { ok: true } or { ok: false, reason: string }.
// All values must be integers. No floats, no strings in payload fields.

export const CMD_ADVANCE_TICK   = "advance_tick";
export const CMD_JOIN_OPERATOR  = "join_operator";
export const CMD_SELECT_ASSET   = "select_asset";
export const CMD_MOVE_ORDER     = "move_order";
export const CMD_FIRE_ORDER     = "fire_order";
export const CMD_TOW_ORDER      = "tow_order";
export const CMD_CRAWL_ORDER    = "crawl_order";
export const CMD_REDEPLOY       = "redeploy";
export const CMD_CALL_MEDIC     = "call_medic";
export const CMD_RESPAWN        = "respawn";

const VALID_TEAMS = new Set([0, 1]);
const VALID_ASSET_TYPES = new Set([0, 1, 2]);

function isUint(v, max) { return Number.isInteger(v) && v >= 0 && v <= max; }
function isCell(v)      { return isUint(v, 127); }

export function validate(cmd) {
  if (!cmd || typeof cmd.type !== "string") return { ok: false, reason: "missing type" };

  switch (cmd.type) {
    case CMD_ADVANCE_TICK:
      return { ok: true };

    case CMD_JOIN_OPERATOR:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      if (!VALID_TEAMS.has(cmd.team))   return { ok: false, reason: "invalid team" };
      return { ok: true };

    case CMD_SELECT_ASSET:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.assetId, 63))     return { ok: false, reason: "invalid assetId" };
      return { ok: true };

    case CMD_MOVE_ORDER:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      if (!isCell(cmd.targetCellX))     return { ok: false, reason: "invalid targetCellX" };
      if (!isCell(cmd.targetCellY))     return { ok: false, reason: "invalid targetCellY" };
      return { ok: true };

    case CMD_FIRE_ORDER:
      if (!isUint(cmd.operatorId, 31))     return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.targetAssetId, 63))  return { ok: false, reason: "invalid targetAssetId" };
      return { ok: true };

    case CMD_TOW_ORDER:
      if (!isUint(cmd.operatorId, 31))    return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.wreckAssetId, 63))  return { ok: false, reason: "invalid wreckAssetId" };
      return { ok: true };

    case CMD_CRAWL_ORDER:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      if (!isCell(cmd.targetCellX))     return { ok: false, reason: "invalid targetCellX" };
      if (!isCell(cmd.targetCellY))     return { ok: false, reason: "invalid targetCellY" };
      return { ok: true };

    case CMD_REDEPLOY:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };

    case CMD_CALL_MEDIC:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };

    case CMD_RESPAWN:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };

    default:
      return { ok: false, reason: `unknown command type: ${cmd.type}` };
  }
}
