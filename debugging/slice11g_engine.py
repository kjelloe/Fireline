# Slice 11G: rescue autopilot option (prompt 16 Q8, controls confirmed
# prompt 19). Boarding stays automatic BY DEFAULT; a per-operator hashed
# autoRescue flag (set_option command) turns it off, and manual mode gets
# explicit board_carrier / unboard commands. Delivery at base stays
# automatic (arriving home IS the goal).

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── state: per-operator autoRescue flag ──────────────────────────────────────
patch("engine/state.js",
"""score: 0, downTimer: 0, lastPingTick: -1000000""",
"""score: 0, downTimer: 0, lastPingTick: -1000000, autoRescue: 1""")

# ── downed.js: boarding respects the flag ────────────────────────────────────
patch("engine/downed.js",
"""// A carrier with a free bunk adjacent to a friendly downed operator.
export function boardableBy(state, carrier) {
  if (carrier.aboard1 !== -1 && carrier.aboard2 !== -1) return null;
  const cx = worldToCellFloor(carrier.x);
  const cy = worldToCellFloor(carrier.y);
  return state.downed.find((d) => {
    if (d.team !== carrier.team) return false;
    const dx = absI32(worldToCellFloor(d.x) - cx);
    const dy = absI32(worldToCellFloor(d.y) - cy);
    return (dx > dy ? dx : dy) <= 1;
  }) ?? null;
}""",
"""// A carrier with a free bunk adjacent to a friendly downed operator.
// 11G: manual seats (autoRescue off) are skipped by the automatic pass —
// they climb aboard with an explicit board_carrier command instead.
export function boardableBy(state, carrier, { manualToo = false } = {}) {
  if (carrier.aboard1 !== -1 && carrier.aboard2 !== -1) return null;
  const cx = worldToCellFloor(carrier.x);
  const cy = worldToCellFloor(carrier.y);
  return state.downed.find((d) => {
    if (d.team !== carrier.team) return false;
    if (!manualToo && state.operators[d.operatorId]?.autoRescue === 0) return false;
    const dx = absI32(worldToCellFloor(d.x) - cx);
    const dy = absI32(worldToCellFloor(d.y) - cy);
    return (dx > dy ? dx : dy) <= 1;
  }) ?? null;
}""")

# ── commands ─────────────────────────────────────────────────────────────────
patch("engine/commands.js",
"""export const CMD_PING           = "ping";        // 10C""",
"""export const CMD_PING           = "ping";        // 10C
export const CMD_SET_OPTION     = "set_option";   // 11G
export const CMD_BOARD_CARRIER  = "board_carrier"; // 11G
export const CMD_UNBOARD        = "unboard";       // 11G""")
patch("engine/commands.js",
"""    case CMD_PING:""",
"""    case CMD_SET_OPTION:
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

    case CMD_PING:""")

# ── reducer: handlers + dispatch ─────────────────────────────────────────────
patch("engine/reducer.js",
"""  CMD_DEPLOY_MINE, CMD_CLEAR_MINE, CMD_PING,""",
"""  CMD_DEPLOY_MINE, CMD_CLEAR_MINE, CMD_PING,
  CMD_SET_OPTION, CMD_BOARD_CARRIER, CMD_UNBOARD,""")
patch("engine/reducer.js",
"""// 10C: a bounded team signal — kind + place, own team only, cooled down.""",
"""// 11G: per-seat preference; the only option so far is the rescue autopilot.
function applySetOption(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state === OP_ABSENT) return reject(next, command, "operator not active");
  operator.autoRescue = command.value;
  next.events.push({
    type: "option_set", operatorId: operator.id,
    option: command.option, value: command.value,
  });
  return next;
}

// 11G: manual boarding — a downed seat climbs into an adjacent friendly
// carrier with a free bunk, on its own decision.
function applyBoardCarrier(next, command) {
  const operator = next.operators[command.operatorId];
  const down = downedFor(next, command.operatorId);
  if (operator.state !== OP_DOWN || !down) return reject(next, command, "not downed");
  const carrier = next.assets[command.carrierAssetId];
  if (!carrier || getUnitStats(carrier.type).capacity <= 0) {
    return reject(next, command, "not a carrier");
  }
  if (carrier.team !== operator.team) return reject(next, command, "asset belongs to other team");
  if (carrier.state === ASSET_DISABLED || carrier.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  if (carrier.aboard1 !== -1 && carrier.aboard2 !== -1) {
    return reject(next, command, "no bunk free");
  }
  const dist = chebyshevCells(carrier, down);
  if (dist > 1) return reject(next, command, "carrier out of reach");
  if (carrier.aboard1 === -1) carrier.aboard1 = operator.id;
  else carrier.aboard2 = operator.id;
  next.downed = next.downed.filter((d) => d.operatorId !== operator.id);
  next.events.push({
    type: "operator_rescued", operatorId: operator.id, byAssetId: carrier.id,
  });
  return next;
}

// 11G: hop out anywhere — back on foot beside the carrier.
function applyUnboard(next, command) {
  const operator = next.operators[command.operatorId];
  const carrier = next.assets.find(
    (a) => a.aboard1 === command.operatorId || a.aboard2 === command.operatorId
  );
  if (operator.state !== OP_DOWN || !carrier) return reject(next, command, "not aboard");
  if (carrier.aboard1 === operator.id) carrier.aboard1 = -1;
  else carrier.aboard2 = -1;
  next.downed.push(createDowned(operator, carrier));
  next.events.push({ type: "operator_unboarded", operatorId: operator.id, fromAssetId: carrier.id });
  return next;
}

// 10C: a bounded team signal — kind + place, own team only, cooled down.""")
patch("engine/reducer.js",
"""    case CMD_PING: return applyPing(next, command);""",
"""    case CMD_PING: return applyPing(next, command);
    case CMD_SET_OPTION: return applySetOption(next, command);
    case CMD_BOARD_CARRIER: return applyBoardCarrier(next, command);
    case CMD_UNBOARD: return applyUnboard(next, command);""")

# ── hashing (snapshot + 1A twin) ─────────────────────────────────────────────
for p in ["engine/snapshot.js", "test/milestone1a.test.js"]:
    patch(p,
"""    w.writeI32LE(o.lastPingTick); // added 10C""",
"""    w.writeI32LE(o.lastPingTick); // added 10C
    w.writeU8(o.autoRescue ?? 1); // added 11G""")

# ── feedback ─────────────────────────────────────────────────────────────────
patch("client/js/feedback_model.js",
"""  "no such site": "No such site.",""",
"""  "not a carrier": "That is not a rescue carrier.",
  "no bunk free": "Both bunks are taken.",
  "carrier out of reach": "Crawl next to the carrier to board.",
  "not aboard": "You are not aboard a carrier.",
  "unknown option": "No such setting.",
  "invalid value": "That setting takes on or off.",
  "no such site": "No such site.",""")
patch("client/js/feedback_model.js",
"""    case "site_shelled": return `Relay ${e.siteId} under artillery fire!`;""",
"""    case "operator_unboarded": return `Operator ${e.operatorId} hopped off.`;
    case "option_set": return null;
    case "site_shelled": return `Relay ${e.siteId} under artillery fire!`;""")
print("11G engine patched")
