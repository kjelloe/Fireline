# 9B: downed operators — state, commands, reducer passes, views, hash.

# commands: crawl_order + redeploy
p = "engine/commands.js"
src = open(p).read()
src = src.replace('export const CMD_TOW_ORDER      = "tow_order";',
'''export const CMD_TOW_ORDER      = "tow_order";
export const CMD_CRAWL_ORDER    = "crawl_order";
export const CMD_REDEPLOY       = "redeploy";''')
src = src.replace("""    case CMD_TOW_ORDER:
      if (!isUint(cmd.operatorId, 31))    return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.wreckAssetId, 63))  return { ok: false, reason: "invalid wreckAssetId" };
      return { ok: true };""",
"""    case CMD_TOW_ORDER:
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
      return { ok: true };""")
open(p, "w").write(src)

# state: downed array + aboard slots on assets
p = "engine/state.js"
src = open(p).read()
src = src.replace("""    heading: team === 1 ? 128 : 0, // brads: A faces east, B faces west (9F)""",
"""    heading: team === 1 ? 128 : 0, // brads: A faces east, B faces west (9F)
    aboard1: -1, aboard2: -1, // 9B: carrier bunks (operator ids)""")
src = src.replace("""    standards, // 8A: physical Command Standards""",
"""    standards, // 8A: physical Command Standards
    downed: [], // 9B: operators on foot""")
open(p, "w").write(src)

# helpers
p = "test/helpers.js"
src = open(p).read()
src = src.replace("    towedBy: spec.towedBy ?? -1, recoverTimer: spec.recoverTimer ?? 0,",
                  "    towedBy: spec.towedBy ?? -1, recoverTimer: spec.recoverTimer ?? 0,\n    aboard1: spec.aboard1 ?? -1, aboard2: spec.aboard2 ?? -1,")
open(p, "w").write(src)

# hash: aboard slots + downed array
for f in ["engine/snapshot.js", "test/milestone1a.test.js"]:
    src = open(f).read()
    src = src.replace("w.writeU8(a.heading); // added 9F",
                      "w.writeU8(a.heading); // added 9F\n    w.writeI32LE(a.aboard1); w.writeI32LE(a.aboard2); // added 9B")
    marker = "for (const st of "
    # append downed loop after standards loop in both files
    src = src.replace("""    w.writeI32LE(st.carrierAssetId); w.writeI32LE(st.status);
    w.writeI32LE(st.droppedTimer); // added 9A
  }""",
"""    w.writeI32LE(st.carrierAssetId); w.writeI32LE(st.status);
    w.writeI32LE(st.droppedTimer); // added 9A
  }
  for (const d of (%s.downed ?? [])) { // added 9B
    w.writeI32LE(d.operatorId); w.writeI32LE(d.team);
    w.writeI32LE(d.x); w.writeI32LE(d.y);
    w.writeI32LE(d.targetX); w.writeI32LE(d.targetY);
    w.writeI32LE(d.downTicks);
  }""" % ("state" if f.startswith("engine") else "s"))
    open(f, "w").write(src)

# reducer wiring
p = "engine/reducer.js"
src = open(p).read()
src = src.replace("""import {
  CMD_ADVANCE_TICK, CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER,
  CMD_FIRE_ORDER, CMD_TOW_ORDER, CMD_CALL_MEDIC, CMD_RESPAWN, validate,
} from "./commands.js";""",
"""import {
  CMD_ADVANCE_TICK, CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER,
  CMD_FIRE_ORDER, CMD_TOW_ORDER, CMD_CRAWL_ORDER, CMD_REDEPLOY,
  CMD_CALL_MEDIC, CMD_RESPAWN, validate,
} from "./commands.js";
import {
  createDowned, downedFor, crawlRejection, boardableBy,
  OPERATOR_SPEED, REDEPLOY_TICKS, OPERATOR_AUTO_RETURN_TICKS,
} from "./downed.js";""")
src = src.replace("import {\n  OP_ABSENT, OP_ACTIVE,",
                  "import {\n  OP_ABSENT, OP_ACTIVE, OP_DOWN,")
src = src.replace("""    standards: state.standards.map((st) => ({ ...st })),
    events: [],""",
"""    standards: state.standards.map((st) => ({ ...st })),
    downed: state.downed.map((d) => ({ ...d })),
    events: [],""")
# crew bails out on disablement
src = src.replace("""  if (target.hp === 0) {
    target.state = ASSET_DISABLED;
    next.teamScores[attacker.team] += SCORE_DISABLE;
    next.events.push({ type: "asset_disabled", assetId: target.id });""",
"""  if (target.hp === 0) {
    target.state = ASSET_DISABLED;
    next.teamScores[attacker.team] += SCORE_DISABLE;
    next.events.push({ type: "asset_disabled", assetId: target.id });
    // 9B: the crew bails out as a downed operator (the wreck repairs to
    // uncrewed — the human/AI seat carries on on foot).
    if (target.operatorId !== -1) {
      const seat = next.operators[target.operatorId];
      seat.state = OP_DOWN;
      seat.assetId = -1;
      next.downed.push(createDowned(seat, target));
      next.events.push({ type: "operator_downed", operatorId: seat.id });
      target.operatorId = -1;
    }""")
# command handlers
src = src.replace("""function applyTowOrder(next, command) {""",
"""function applyCrawlOrder(next, command) {
  const downed = downedFor(next, command.operatorId);
  const why = crawlRejection(downed, command.targetCellX, command.targetCellY);
  if (why) return reject(next, command, why);
  downed.targetX = cellToWorld(command.targetCellX);
  downed.targetY = cellToWorld(command.targetCellY);
  next.events.push({
    type: "crawl_ordered", operatorId: downed.operatorId,
    targetX: downed.targetX, targetY: downed.targetY,
  });
  return next;
}

function freeSeat(next, operatorId, eventType, extra = {}) {
  const seat = next.operators[operatorId];
  seat.state = OP_ACTIVE;
  seat.assetId = -1;
  next.downed = next.downed.filter((d) => d.operatorId !== operatorId);
  next.events.push({ type: eventType, operatorId, ...extra });
}

function applyRedeploy(next, command) {
  const downed = downedFor(next, command.operatorId);
  if (!downed) return reject(next, command, "not downed");
  if (downed.downTicks < REDEPLOY_TICKS) return reject(next, command, "still recovering nerve");
  freeSeat(next, command.operatorId, "operator_redeployed");
  return next;
}

function applyTowOrder(next, command) {""")
src = src.replace("""    case CMD_TOW_ORDER: return applyTowOrder(next, command);""",
"""    case CMD_TOW_ORDER: return applyTowOrder(next, command);
    case CMD_CRAWL_ORDER: return applyCrawlOrder(next, command);
    case CMD_REDEPLOY: return applyRedeploy(next, command);""")
# advance_tick: downed pass (crawl movement, timers, boarding, unload)
src = src.replace("""  // Recovery pass (8D): a towed wreck reaching its own base enters the""",
"""  // Downed-operator pass (9B): crawl, count, board carriers, deliver.
  for (const d of [...next.downed]) {
    d.downTicks += 1;
    // Crawl toward target, axis-major at foot speed. No heading for feet.
    let ddx = d.targetX - d.x;
    let ddy = d.targetY - d.y;
    let remaining = OPERATOR_SPEED;
    if (absI32(ddx) >= absI32(ddy)) {
      const mx = Math.min(absI32(ddx), remaining);
      d.x += ddx < 0 ? -mx : mx; remaining -= mx;
      const my = Math.min(absI32(ddy), remaining);
      d.y += ddy < 0 ? -my : my;
    } else {
      const my = Math.min(absI32(ddy), remaining);
      d.y += ddy < 0 ? -my : my; remaining -= my;
      const mx = Math.min(absI32(ddx), remaining);
      d.x += ddx < 0 ? -mx : mx;
    }
    if (d.downTicks >= OPERATOR_AUTO_RETURN_TICKS) {
      freeSeat(next, d.operatorId, "operator_returned", { auto: true });
    }
  }
  // Carrier boarding: adjacent friendly downed operators climb aboard.
  for (const carrier of next.assets) {
    if (getUnitStats(carrier.type).capacity <= 0) continue;
    if (carrier.state === ASSET_DISABLED || carrier.state === ASSET_SALVAGED) continue;
    let bunkable = boardableBy(next, carrier);
    while (bunkable) {
      if (carrier.aboard1 === -1) carrier.aboard1 = bunkable.operatorId;
      else carrier.aboard2 = bunkable.operatorId;
      next.downed = next.downed.filter((d) => d.operatorId !== bunkable.operatorId);
      next.events.push({
        type: "operator_rescued", operatorId: bunkable.operatorId, byAssetId: carrier.id,
      });
      bunkable = boardableBy(next, carrier);
    }
  }
  // Delivery: an idle carrier in its own base unloads everyone aboard.
  for (const carrier of next.assets) {
    if (carrier.aboard1 === -1 && carrier.aboard2 === -1) continue;
    if (carrier.state !== ASSET_IDLE || !inOwnBase(next, carrier)) continue;
    for (const slot of ["aboard1", "aboard2"]) {
      const operatorId = carrier[slot];
      if (operatorId === -1) continue;
      carrier[slot] = -1;
      const seat = next.operators[operatorId];
      seat.state = OP_ACTIVE;
      seat.assetId = -1;
      next.events.push({ type: "operator_delivered", operatorId });
    }
  }

  // Recovery pass (8D): a towed wreck reaching its own base enters the""")
open(p, "w").write(src)

# views: own team's downed operators (enemies never see them)
p = "engine/view.js"
src = open(p).read()
src = src.replace("""  const bases = state.bases.map((b) => ({ ...b }));""",
"""  const bases = state.bases.map((b) => ({ ...b }));
  // 9B: downed operators are visible to their OWN team only (enemies cannot
  // see or target them — follow-up ruling 1).
  const downedOperators = state.downed
    .filter((d) => d.team === team)
    .map((d) => ({ ...d }));""")
src = src.replace("""    sites,
    bases,
    standards,
  };""",
"""    sites,
    bases,
    standards,
    downedOperators,
  };""")
open(p, "w").write(src)

# feedback + metrics + cues
p = "client/js/feedback_model.js"
src = open(p).read()
src = src.replace('  "war is over": "The war is over — next one starts shortly.",',
'''  "not downed": "You are not on foot.",
  "too far to crawl": "Too far — downed operators can only crawl a short way.",
  "still recovering nerve": "Hold on — redeploy unlocks a few seconds after going down.",
  "war is over": "The war is over — next one starts shortly.",''')
src = src.replace('    case "tow_started": return `Asset ${e.by} is towing wreck ${e.assetId}.`;',
'''    case "operator_downed": return `Operator ${e.operatorId} is DOWN — crawl to cover, redeploy, or await a carrier.`;
    case "operator_rescued": return `Carrier ${e.byAssetId} picked up operator ${e.operatorId}!`;
    case "operator_delivered": return `Operator ${e.operatorId} delivered safe — take a new asset.`;
    case "operator_redeployed": return `Operator ${e.operatorId} redeployed — take a new asset.`;
    case "operator_returned": return `Operator ${e.operatorId} made it back on foot.`;
    case "crawl_ordered": return null;
    case "tow_started": return `Asset ${e.by} is towing wreck ${e.assetId}.`;''')
open(p, "w").write(src)

p = "server/metrics.js"
src = open(p).read()
src = src.replace('    towsStarted: 0,\n    recoveries: 0,',
                  '    towsStarted: 0,\n    recoveries: 0,\n    operatorsDowned: 0,\n    operatorsRescued: 0,')
src = src.replace('          case "tow_started": counters.towsStarted++; break;',
'''          case "tow_started": counters.towsStarted++; break;
          case "operator_downed": counters.operatorsDowned++; break;
          case "operator_rescued": counters.operatorsRescued++; break;''')
open(p, "w").write(src)
print("9B engine wired")
