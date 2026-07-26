# Slice 9G: anti-camping drone — engine edits (state, reducer, view,
# snapshot, hash test, metrics, feedback). engine/drone.js written separately.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── state.js: drones array + id counter + per-asset camp timer ───────────────
patch("engine/state.js",
"""    mines: [], // 9E: deployed mines
    nextMineId: 0,""",
"""    mines: [], // 9E: deployed mines
    nextMineId: 0,
    drones: [], // 9G: anti-camping drones aloft
    nextDroneId: 0,""")
patch("engine/state.js",
"""    minesLeft: getUnitStats(type).canMine ? MINES_PER_TANK : 0, // 9E mine rack
  };""",
"""    minesLeft: getUnitStats(type).canMine ? MINES_PER_TANK : 0, // 9E mine rack
    campTicks: 0, // 9G: unsupplied-idle counter that draws a drone
  };""")

# ── reducer.js ───────────────────────────────────────────────────────────────
patch("engine/reducer.js",
"""import {
  MINE_ARM_TICKS, MINE_DAMAGE, MINE_DETECT_RADIUS_CELLS,
  deployRejection, clearRejection, isArmed,
} from "./mines.js";""",
"""import {
  MINE_ARM_TICKS, MINE_DAMAGE, MINE_DETECT_RADIUS_CELLS,
  deployRejection, clearRejection, isArmed,
} from "./mines.js";
import {
  CAMP_TICKS, DRONE_LIFETIME, DRONE_HIT_INTERVAL, DRONE_DAMAGE,
  DRONE_STATION_CELLS, launchSiteFor, stepDrone,
} from "./drone.js";""")

patch("engine/reducer.js",
"""    mines: state.mines.map((m) => ({ ...m })),""",
"""    mines: state.mines.map((m) => ({ ...m })),
    drones: state.drones.map((d) => ({ ...d })),""")

# fire_order may target a drone instead of an asset (any direct-fire unit,
# one hit downs it). Insert the branch right after the operable check.
patch("engine/reducer.js",
"""  if (attacker.state === ASSET_DISABLED || attacker.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  const target = next.assets[command.targetAssetId];
  if (!target) return reject(next, command, "no such target");""",
"""  if (attacker.state === ASSET_DISABLED || attacker.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  // 9G: shooting at a drone. Drones are public and airborne: no spotting or
  // LOS gates, but indirect tubes cannot track aircraft, and normal ammo/
  // reload/supply/range discipline still applies. One hit downs it.
  if (command.targetDroneId !== undefined) {
    const drone = next.drones.find((d) => d.id === command.targetDroneId);
    if (!drone) return reject(next, command, "no such drone");
    if (getUnitStats(attacker.type).indirect) {
      return reject(next, command, "cannot track aircraft");
    }
    if (attacker.reloadTimer > 0) return reject(next, command, "reloading");
    if (attacker.ammo < SUPPLY_FIRE_COST) return reject(next, command, "out of ammo");
    if (!inSupply(next, attacker)) return reject(next, command, "out of supply");
    if (!inFireRange(attacker, drone)) return reject(next, command, "target out of range");
    attacker.ammo -= SUPPLY_FIRE_COST;
    attacker.reloadTimer = getUnitStats(attacker.type).reloadTicks;
    next.drones = next.drones.filter((d) => d.id !== drone.id);
    next.events.push({ type: "drone_downed", droneId: drone.id, byAssetId: attacker.id });
    return next;
  }
  const target = next.assets[command.targetAssetId];
  if (!target) return reject(next, command, "no such target");""")

# Tick passes: camp tracking + launch, then drone flight/sting/recall.
# Runs right after the mine passes.
patch("engine/reducer.js",
"""  // Anti-deadlock (9A): a standard left dropped long enough returns home.""",
"""  // 9G anti-camping: idling outside your own supply umbrella draws a drone
  // from the enemy's nearest owned relay.
  for (const asset of next.assets) {
    if (asset.state === ASSET_IDLE && !inSupply(next, asset)) {
      asset.campTicks += 1;
    } else {
      asset.campTicks = 0;
    }
    if (asset.campTicks < CAMP_TICKS) continue;
    asset.campTicks = 0; // pay the toll, restart the clock
    if (next.drones.some((d) => d.targetAssetId === asset.id)) continue;
    const pad = launchSiteFor(next, asset, chebyshevCells);
    if (!pad) continue; // enemy owns no relay — nowhere to launch from
    next.drones.push({
      id: next.nextDroneId, team: asset.team === 0 ? 1 : 0,
      x: cellToWorld(pad.cellX), y: cellToWorld(pad.cellY),
      targetAssetId: asset.id, ageTicks: 0, hitTimer: 0,
    });
    next.nextDroneId += 1;
    next.events.push({
      type: "drone_launched", droneId: next.nextDroneId - 1,
      targetAssetId: asset.id, siteId: pad.id,
    });
  }
  if (next.drones.length > 0) {
    const gone = new Set();
    for (const drone of next.drones) {
      drone.ageTicks += 1;
      const target = next.assets[drone.targetAssetId];
      // Recall: endurance spent, target gone/moving/back in supply — the
      // counterplay is simply to stop camping.
      if (
        drone.ageTicks >= DRONE_LIFETIME ||
        !target || target.state === ASSET_DISABLED || target.state === ASSET_SALVAGED ||
        target.state === ASSET_MOVING || inSupply(next, target)
      ) {
        gone.add(drone.id);
        next.events.push({ type: "drone_recalled", droneId: drone.id });
        continue;
      }
      stepDrone(drone, target.x, target.y);
      if (chebyshevCells(drone, target) > DRONE_STATION_CELLS) {
        drone.hitTimer = 0;
        continue;
      }
      drone.hitTimer += 1;
      if (drone.hitTimer < DRONE_HIT_INTERVAL) continue;
      drone.hitTimer = 0;
      target.hp = Math.max(0, target.hp - DRONE_DAMAGE);
      next.events.push({
        type: "drone_hit", droneId: drone.id, assetId: target.id, targetHp: target.hp,
      });
      if (target.hp === 0) disableAsset(next, target, drone.team);
    }
    if (gone.size > 0) next.drones = next.drones.filter((d) => !gone.has(d.id));
  }

  // Anti-deadlock (9A): a standard left dropped long enough returns home.""")

# ── commands.js: fire_order accepts targetDroneId as an alternative ─────────
patch("engine/commands.js",
"""    case CMD_FIRE_ORDER:
      if (!isUint(cmd.operatorId, 31))     return { ok: false, reason: "invalid operatorId" };
      if (!isUint(cmd.targetAssetId, 63))  return { ok: false, reason: "invalid targetAssetId" };
      return { ok: true };""",
"""    case CMD_FIRE_ORDER:
      if (!isUint(cmd.operatorId, 31))     return { ok: false, reason: "invalid operatorId" };
      if (cmd.targetDroneId !== undefined) { // 9G: air target instead
        if (!isUint(cmd.targetDroneId, 0xffff)) return { ok: false, reason: "invalid targetDroneId" };
        return { ok: true };
      }
      if (!isUint(cmd.targetAssetId, 63))  return { ok: false, reason: "invalid targetAssetId" };
      return { ok: true };""")

# ── view.js: drones are public to both teams ─────────────────────────────────
patch("engine/view.js",
"""  // 8A: Command Standards are a deliberate fog exception""",
"""  // 9G: drones are loud, low, and public — both teams always see them.
  const drones = state.drones.map((d) => ({
    id: d.id, team: d.team, x: d.x, y: d.y, targetAssetId: d.targetAssetId,
  }));
  // 8A: Command Standards are a deliberate fog exception""")
patch("engine/view.js",
"""    standards,
    downedOperators,
    mines,
  };""",
"""    standards,
    downedOperators,
    mines,
    drones,
  };""")

# ── hashing: snapshot + 1A test twin ─────────────────────────────────────────
for p in ["engine/snapshot.js", "test/milestone1a.test.js"]:
    patch(p,
"""    w.writeU8(a.minesLeft); // added 9E""",
"""    w.writeU8(a.minesLeft); // added 9E
    w.writeI32LE(a.campTicks); // added 9G""")
hash_tail_snapshot = """  w.writeI32LE(state.nextMineId ?? 0); // added 9E
  for (const m of (state.mines ?? [])) {
    w.writeI32LE(m.id); w.writeI32LE(m.team);
    w.writeI32LE(m.cellX); w.writeI32LE(m.cellY);
    w.writeI32LE(m.armTimer); w.writeU8(m.marked);
  }"""
hash_tail_snapshot_new = hash_tail_snapshot + """
  w.writeI32LE(state.nextDroneId ?? 0); // added 9G
  for (const d of (state.drones ?? [])) {
    w.writeI32LE(d.id); w.writeI32LE(d.team);
    w.writeI32LE(d.x); w.writeI32LE(d.y);
    w.writeI32LE(d.targetAssetId); w.writeI32LE(d.ageTicks); w.writeI32LE(d.hitTimer);
  }"""
patch("engine/snapshot.js", hash_tail_snapshot, hash_tail_snapshot_new)
patch("test/milestone1a.test.js",
      hash_tail_snapshot.replace("state.", "s."),
      hash_tail_snapshot_new.replace("state.", "s."))

# ── helpers: sandbox assets get the camp timer ──────────────────────────────
patch("test/helpers.js",
"""    minesLeft: spec.minesLeft ?? ((spec.type ?? 0) === 0 ? 2 : 0), // 9E""",
"""    minesLeft: spec.minesLeft ?? ((spec.type ?? 0) === 0 ? 2 : 0), // 9E
    campTicks: spec.campTicks ?? 0, // 9G""")

# ── metrics + feedback ───────────────────────────────────────────────────────
patch("server/metrics.js",
"""    minesCleared: 0,""",
"""    minesCleared: 0,
    dronesLaunched: 0,
    dronesDowned: 0,""")
patch("server/metrics.js",
"""          case "mine_cleared": counters.minesCleared++; break;""",
"""          case "mine_cleared": counters.minesCleared++; break;
          case "drone_launched": counters.dronesLaunched++; break;
          case "drone_downed": counters.dronesDowned++; break;""")
patch("client/js/feedback_model.js",
"""  "war is over": "The war is over — next one starts shortly.",
});""",
"""  "no such drone": "That drone is already gone.",
  "cannot track aircraft": "Artillery cannot track aircraft — use a direct gun.",
  "war is over": "The war is over — next one starts shortly.",
});""")
patch("client/js/feedback_model.js",
"""    case "mine_cleared": return `Mine cleared by asset ${e.assetId}.`;""",
"""    case "mine_cleared": return `Mine cleared by asset ${e.assetId}.`;
    case "drone_launched":
      return "DRONE UP — someone idled too long off supply. Move or shoot it down.";
    case "drone_hit": return `Drone stinging asset ${e.assetId} — move!`;
    case "drone_downed": return `Drone downed by asset ${e.byAssetId}.`;
    case "drone_recalled": return "The drone broke off.";""")

print("9G engine patched")
