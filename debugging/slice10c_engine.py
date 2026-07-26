# Slice 10C (plan 2.3): context pings — command, cooldown, toTeam-scoped
# events, view filtering, feedback. engine/pings.js written separately.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── commands.js ──────────────────────────────────────────────────────────────
patch("engine/commands.js",
"""export const CMD_DEPLOY_MINE    = "deploy_mine"; // 9E""",
"""export const CMD_PING           = "ping";        // 10C
export const CMD_DEPLOY_MINE    = "deploy_mine"; // 9E""")
patch("engine/commands.js",
"""    case CMD_DEPLOY_MINE:""",
"""    case CMD_PING:
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

    case CMD_DEPLOY_MINE:""")

# ── state: per-operator ping cooldown (hashed) ───────────────────────────────
src = open("engine/state.js").read()
assert "lastPingTick" not in src
patch("engine/state.js",
"""score: 0, downTimer: 0""",
"""score: 0, downTimer: 0, lastPingTick: -1000000""")

# ── reducer ──────────────────────────────────────────────────────────────────
patch("engine/reducer.js",
"""import {
  CAMP_TICKS, DRONE_LIFETIME, DRONE_HIT_INTERVAL, DRONE_DAMAGE,
  DRONE_STATION_CELLS, launchSiteFor, stepDrone,
} from "./drone.js";""",
"""import {
  CAMP_TICKS, DRONE_LIFETIME, DRONE_HIT_INTERVAL, DRONE_DAMAGE,
  DRONE_STATION_CELLS, launchSiteFor, stepDrone,
} from "./drone.js";
import { PING_KINDS, PING_COOLDOWN_TICKS, pingRejection } from "./pings.js";""")
patch("engine/reducer.js",
"""  CMD_DEPLOY_MINE, CMD_CLEAR_MINE,""",
"""  CMD_DEPLOY_MINE, CMD_CLEAR_MINE, CMD_PING,""")
patch("engine/reducer.js",
"""// 9E: lay a mine on the asset's own cell (arms after MINE_ARM_TICKS).""",
"""// 10C: a bounded team signal — kind + place, own team only, cooled down.
function applyPing(next, command) {
  const operator = next.operators[command.operatorId];
  if (!PING_KINDS.includes(command.kind)) return reject(next, command, "unknown ping kind");
  const why = pingRejection(operator.state, OP_ACTIVE, OP_DOWN, command.kind);
  if (why) return reject(next, command, why);
  if (next.tick - operator.lastPingTick < PING_COOLDOWN_TICKS) {
    return reject(next, command, "ping cooling down");
  }
  // Where: a downed seat pings its own body; a driving seat pings the
  // target cell if given, else its asset's cell; a seatless active
  // operator (in the garage) must give a target cell.
  let cellX = command.targetCellX;
  let cellY = command.targetCellY;
  if (operator.state === OP_DOWN) {
    const body = downedFor(next, operator.id);
    cellX = worldToCellFloor(body.x);
    cellY = worldToCellFloor(body.y);
  } else if (cellX === undefined || cellY === undefined) {
    const asset = operator.assetId === -1 ? null : next.assets[operator.assetId];
    if (!asset) return reject(next, command, "ping needs a target cell");
    cellX = worldToCellFloor(asset.x);
    cellY = worldToCellFloor(asset.y);
  }
  operator.lastPingTick = next.tick;
  next.events.push({
    type: "ping", toTeam: operator.team, operatorId: operator.id,
    kind: command.kind, cellX, cellY, tick: next.tick,
  });
  return next;
}

// 9E: lay a mine on the asset's own cell (arms after MINE_ARM_TICKS).""")
patch("engine/reducer.js",
"""    case CMD_DEPLOY_MINE: return applyDeployMine(next, command);""",
"""    case CMD_PING: return applyPing(next, command);
    case CMD_DEPLOY_MINE: return applyDeployMine(next, command);""")

# ── view: toTeam-scoped events (pings never leak to the enemy) ───────────────
patch("engine/view.js",
"""    events: state.events,""",
"""    // 10C: events carrying toTeam are that team's business only (pings).
    events: state.events.filter((e) => e.toTeam === undefined || e.toTeam === team),""")

# ── hashing: operator lastPingTick, snapshot + 1A twin ───────────────────────
patch("engine/snapshot.js",
"""    w.writeI32LE(o.assetId); w.writeI32LE(o.score); w.writeI32LE(o.downTimer);
  }""",
"""    w.writeI32LE(o.assetId); w.writeI32LE(o.score); w.writeI32LE(o.downTimer);
    w.writeI32LE(o.lastPingTick); // added 10C
  }""")
patch("test/milestone1a.test.js",
"""    w.writeI32LE(o.assetId); w.writeI32LE(o.score); w.writeI32LE(o.downTimer);
  }""",
"""    w.writeI32LE(o.assetId); w.writeI32LE(o.score); w.writeI32LE(o.downTimer);
    w.writeI32LE(o.lastPingTick); // added 10C
  }""")

# ── feedback ─────────────────────────────────────────────────────────────────
patch("client/js/feedback_model.js",
"""  "takeover needs confirmation":""",
"""  "unknown ping kind": "That signal is not in the book.",
  "ping cooling down": "Signal lamp recharging — a moment.",
  "only rescue pings while down": "On foot you can only call for rescue.",
  "ping needs a target cell": "Pick a spot on the map to signal about.",
  "takeover needs confirmation":""")
patch("client/js/feedback_model.js",
"""    case "drone_launched":""",
"""    case "ping": {
      const label = (e.kind ?? "").replace(/_/g, " ").toUpperCase();
      return `[PING] ${label} @ (${e.cellX},${e.cellY})`;
    }
    case "drone_launched":""")
print("10C engine patched")
