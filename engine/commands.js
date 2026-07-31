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
export const CMD_PING           = "ping";        // 10C
export const CMD_DRIVE          = "drive";        // 11L direct control
export const CMD_TRANSFER_CARGO = "transfer_cargo";     // 13A
export const CMD_DEPLOY_HARDPOINT = "deploy_hardpoint"; // 12B
export const CMD_UNDEPLOY       = "undeploy";           // 12B
export const CMD_SET_OPTION     = "set_option";   // 11G
export const CMD_BOARD_CARRIER  = "board_carrier"; // 11G
export const CMD_UNBOARD        = "unboard";       // 11G
export const CMD_DEPLOY_MINE    = "deploy_mine"; // 9E
export const CMD_DEPLOY_CALTROPS = "deploy_caltrops"; // Q45/Q50 chase-shapers
export const CMD_CLEAR_MINE     = "clear_mine";  // 9E
export const CMD_CALL_MEDIC     = "call_medic";
// Crew stations (prompt-100 prototype): a SECOND seat on station-
// bearing chassis — the carrier's MG ring, the scout's AT launcher.
// Board mirrors select_asset semantics (garage-style, no adjacency).
export const CMD_BOARD_STATION  = "board_station";
export const CMD_LEAVE_STATION  = "leave_station";
export const CMD_STATION_FIRE   = "station_fire";
// Q41 ruling: the driver may EJECT station crew — with a server-run
// delay + a warning event, so the crew always sees it coming.
export const CMD_EJECT_STATION  = "eject_station";
export const CMD_RESPAWN        = "respawn";
export const CMD_SATCHEL        = "satchel"; // prompt-51: downed-crew AT charge

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
      if (cmd.confirm !== undefined && typeof cmd.confirm !== "boolean") {
        return { ok: false, reason: "invalid confirm" }; // 10B
      }
      return { ok: true };

    case CMD_MOVE_ORDER:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      if (cmd.queue !== undefined && typeof cmd.queue !== "boolean") {
        return { ok: false, reason: "invalid queue" }; // item 34
      }
      if (!isCell(cmd.targetCellX))     return { ok: false, reason: "invalid targetCellX" };
      if (!isCell(cmd.targetCellY))     return { ok: false, reason: "invalid targetCellY" };
      return { ok: true };

    case CMD_FIRE_ORDER:
      if (!isUint(cmd.operatorId, 31))     return { ok: false, reason: "invalid operatorId" };
      if (cmd.targetSiteId !== undefined) { // 11F: infrastructure target
        if (!isUint(cmd.targetSiteId, 0xffff)) return { ok: false, reason: "invalid targetSiteId" };
        return { ok: true };
      }
      if (cmd.targetDroneId !== undefined) { // 9G: air target instead
        if (!isUint(cmd.targetDroneId, 0xffff)) return { ok: false, reason: "invalid targetDroneId" };
        return { ok: true };
      }
      if (cmd.targetBridgeId !== undefined) { // 13E: droppable crossing
        if (!isUint(cmd.targetBridgeId, 0xffff)) return { ok: false, reason: "invalid targetBridgeId" };
        return { ok: true };
      }
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

    case CMD_TRANSFER_CARGO:
      if (!isUint(cmd.operatorId, 31))    return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.targetAssetId, 63)) return { ok: false, reason: "invalid targetAssetId" };
      return { ok: true };

    case CMD_DEPLOY_HARDPOINT:
    case CMD_UNDEPLOY:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };

    case CMD_DRIVE: {
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      const ok = (v) => v === -1 || v === 0 || v === 1;
      if (!ok(cmd.throttle)) return { ok: false, reason: "invalid throttle" };
      if (!ok(cmd.turn))     return { ok: false, reason: "invalid turn" };
      return { ok: true };
    }

    case CMD_SET_OPTION:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      if (cmd.option !== "auto_rescue") return { ok: false, reason: "unknown option" };
      if (cmd.value !== 0 && cmd.value !== 1) return { ok: false, reason: "invalid value" };
      return { ok: true };

    case CMD_BOARD_CARRIER:
      if (!isUint(cmd.operatorId, 31))       return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.carrierAssetId, 63))   return { ok: false, reason: "invalid carrierAssetId" };
      return { ok: true };

    case CMD_UNBOARD:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };

    case CMD_BOARD_STATION:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.assetId, 63))     return { ok: false, reason: "invalid assetId" };
      return { ok: true };

    case CMD_LEAVE_STATION:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };

    case CMD_STATION_FIRE:
      if (!isUint(cmd.operatorId, 31))     return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.targetAssetId, 63))  return { ok: false, reason: "invalid targetAssetId" };
      return { ok: true };

    case CMD_EJECT_STATION:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };

    case CMD_PING:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      if (typeof cmd.kind !== "string" || cmd.kind.length > 32) {
        return { ok: false, reason: "invalid kind" };
      }
      if (cmd.targetCellX !== undefined && !isCell(cmd.targetCellX)) {
        return { ok: false, reason: "invalid targetCellX" };
      }
      if (cmd.targetCellY !== undefined && !isCell(cmd.targetCellY)) {
        return { ok: false, reason: "invalid targetCellY" };
      }
      return { ok: true };

    case CMD_DEPLOY_MINE:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };

    case CMD_DEPLOY_CALTROPS:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };

    case CMD_CLEAR_MINE:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.mineId, 0xffff))  return { ok: false, reason: "invalid mineId" };
      return { ok: true };

    case CMD_CALL_MEDIC:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };

    case CMD_SATCHEL:
      if (!isUint(cmd.operatorId, 31)) return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.targetAssetId, 31)) return { ok: false, reason: "invalid targetAssetId" };
      return { ok: true };
    case CMD_RESPAWN:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };

    default:
      return { ok: false, reason: `unknown command type: ${cmd.type}` };
  }
}
