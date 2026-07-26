# Slice 12B: the Directorate Sentinel (designer ruling, prompt 29).
# Deploy Hardpoint: mobile it is slow and lightly armed; DEPLOYED it is an
# immobile fortress with artillery-class direct reach. Transition takes
# 3 s each way (immobile, guns cold). Numbers are mine — flagged for
# tuning. Replaces team A's garage tank at reserve idx 10 (id 18); the
# roster stays 16 per team per the directive.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── units: chassis + effective-combat-stats helper ───────────────────────────
patch("engine/units.js",
"""export const UNIT_MORTAR = 6;  // 11S: mortar carrier""",
"""export const UNIT_MORTAR = 6;  // 11S: mortar carrier
export const UNIT_SENTINEL = 7; // 12B: Directorate unique""")
patch("engine/units.js",
"""  // 11S (prompt 22): the Mortar Carrier""",
"""  // 12B (prompt 29): the Directorate Sentinel — Deploy Hardpoint. Mobile:
  // a crawling, lightly-armed hull. Deployed: an immobile hardpoint with
  // artillery-class DIRECT reach. fortify · contain · stabilize.
  [UNIT_SENTINEL]: Object.freeze({
    id: UNIT_SENTINEL, name: "sentinel",
    speed: 12, range: 1024, minRange: 0, hp: 150, damage: 8, indirect: false, reloadTicks: 20,
    canTow: false, canCarryStandard: false, capacity: 0, turnRate: 4,
    canMine: false, canClearMines: false,
    heavy: true,
    canCapture: true, siege: false,
    deployable: true,
    deployedRange: 2048, deployedDamage: 25, deployedReloadTicks: 20,
  }),
  // 11S (prompt 22): the Mortar Carrier""")
src = open("engine/units.js").read()
# deployable: false explicitly on every other chassis (contract style).
count = src.count("    canCapture: true, siege: false, // 11R")
src = src.replace("    canCapture: true, siege: false, // 11R",
                  "    canCapture: true, siege: false, // 11R\n    deployable: false, // 12B")
src = src.replace("    canCapture: true, siege: true, // 11R: ONLY artillery breaches sites (Q9)",
                  "    canCapture: true, siege: true, // 11R: ONLY artillery breaches sites (Q9)\n    deployable: false, // 12B")
src = src.replace("""    canCapture: false, siege: false,
  }),""",
"""    canCapture: false, siege: false,
    deployable: false, // 12B
  }),""", 1)
src = src.replace("""    canCapture: true, siege: false,
  }),
});""",
"""    canCapture: true, siege: false,
    deployable: false, // 12B
  }),
});""", 1)
open("engine/units.js", "w").write(src)
patch("engine/units.js",
"""export function getUnitStats(type) {
  return UNIT_STATS[type] ?? UNIT_STATS[UNIT_TANK];
}""",
"""export function getUnitStats(type) {
  return UNIT_STATS[type] ?? UNIT_STATS[UNIT_TANK];
}

// 12B: combat numbers depend on the hardpoint state. An ACTIVE hardpoint
// (deployed, transition finished) fights with its deployed profile;
// everything else uses the base chassis numbers.
export function effectiveCombat(asset) {
  const stats = getUnitStats(asset.type);
  if (stats.deployable && asset.deployed === 1 && (asset.deployTimer ?? 0) === 0) {
    return {
      range: stats.deployedRange, minRange: stats.minRange,
      damage: stats.deployedDamage, reloadTicks: stats.deployedReloadTicks,
    };
  }
  return {
    range: stats.range, minRange: stats.minRange,
    damage: stats.damage, reloadTicks: stats.reloadTicks,
  };
}""")

# ── combat honors effective stats ────────────────────────────────────────────
patch("engine/combat.js",
"""import { getUnitStats } from "./units.js";""",
"""import { getUnitStats, effectiveCombat } from "./units.js";""")
patch("engine/combat.js",
"""export function resolveShot(attacker, target) {
  return {
    hpDelta: getUnitStats(attacker.type).damage,
    suppressed: true,
  };
}""",
"""export function resolveShot(attacker, target) {
  return {
    hpDelta: effectiveCombat(attacker).damage, // 12B: hardpoint profile
    suppressed: true,
  };
}""")
patch("engine/combat.js",
"""export function inFireRange(attacker, target) {
  const stats = getUnitStats(attacker.type);""",
"""export function inFireRange(attacker, target) {
  const stats = effectiveCombat(attacker); // 12B: hardpoint profile""")

# ── state: per-asset deploy fields + PER-TEAM reserve tables ─────────────────
patch("engine/state.js",
"""    driveThrottle: 0, driveTurn: 0, // 11L: direct-control intent
  };""",
"""    driveThrottle: 0, driveTurn: 0, // 11L: direct-control intent
    deployed: 0, deployTimer: 0, // 12B: Deploy Hardpoint
  };""")
patch("engine/state.js",
"""// 11R: garage slot idx 4 (ids 12 / 24) traded from tank to Scout Bike.
// 11S: garage slot idx 6 (ids 14 / 26) traded from artillery to Mortar.
// Indices 0-3 are AI-paired (assets 8-11 / 20-23) — never reordered.
const RESERVE_TYPES = [4, 3, 1, 0, 5, 1, 6, 3, 2, 3, 0, 4];""",
"""// 11R: garage slot idx 4 (ids 12 / 24) traded from tank to Scout Bike.
// 11S: garage slot idx 6 (ids 14 / 26) traded from artillery to Mortar.
// 12B/12C (designer directive): the FACTION UNIQUES replace garage slot
// idx 10 (ids 18 / 30) — Directorate Sentinel west, Outlier Skimmer east.
// No 17th asset; indices 0-3 stay AI-paired and never reorder.
const RESERVE_TYPES_BY_TEAM = [
  [4, 3, 1, 0, 5, 1, 6, 3, 2, 3, 7, 4], // team 0: The Directorate
  [4, 3, 1, 0, 5, 1, 6, 3, 2, 3, 0, 4], // team 1: The Outliers (Skimmer in 12C)
];""")
src = open("engine/state.js").read()
src = src.replace("RESERVE_TYPES[slot % 12]", "RESERVE_TYPES_BY_TEAM[team][slot % 12]")
assert "RESERVE_TYPES[" not in src.replace("RESERVE_TYPES_BY_TEAM[", "")
open("engine/state.js", "w").write(src)
src = open("engine/state.js").read()
import re
m = re.search(r"const type = RESERVE_TYPES", src)
# createFieldAssets reserve loop: find remaining plain uses
leftover = [l for l in src.splitlines() if "RESERVE_TYPES" in l and "BY_TEAM" not in l]
assert not leftover, leftover

# ── commands ─────────────────────────────────────────────────────────────────
patch("engine/commands.js",
"""export const CMD_DRIVE          = "drive";        // 11L direct control""",
"""export const CMD_DRIVE          = "drive";        // 11L direct control
export const CMD_DEPLOY_HARDPOINT = "deploy_hardpoint"; // 12B
export const CMD_UNDEPLOY       = "undeploy";           // 12B""")
patch("engine/commands.js",
"""    case CMD_DRIVE: {""",
"""    case CMD_DEPLOY_HARDPOINT:
    case CMD_UNDEPLOY:
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      return { ok: true };

    case CMD_DRIVE: {""")

# ── reducer: handlers, transition pass, movement/fire gates ──────────────────
patch("engine/reducer.js",
"""  CMD_SET_OPTION, CMD_BOARD_CARRIER, CMD_UNBOARD, CMD_DRIVE,""",
"""  CMD_SET_OPTION, CMD_BOARD_CARRIER, CMD_UNBOARD, CMD_DRIVE,
  CMD_DEPLOY_HARDPOINT, CMD_UNDEPLOY,""")
patch("engine/reducer.js",
"""// 11L: direct control — store the seat's drive intent on its asset.""",
"""// 12B: Deploy Hardpoint (3 s each way, immobile and guns cold while the
// legs work). Deployed flag flips IMMEDIATELY; "active" means the timer
// has finished — effectiveCombat() reads exactly that.
export const HARDPOINT_TRANSITION_TICKS = 30;

function hardpointSeat(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return { err: "operator not active" };
  if (operator.assetId === -1) return { err: "no asset selected" };
  const asset = next.assets[operator.assetId];
  if (!asset || asset.operatorId !== operator.id) return { err: "no asset selected" };
  if (asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED) {
    return { err: "asset not operable" };
  }
  if (!getUnitStats(asset.type).deployable) return { err: "cannot deploy here" };
  if (asset.deployTimer > 0) return { err: "still transitioning" };
  return { asset };
}

function applyDeployHardpoint(next, command) {
  const { asset, err } = hardpointSeat(next, command);
  if (err) return reject(next, command, err);
  if (asset.deployed === 1) return reject(next, command, "already deployed");
  asset.deployed = 1;
  asset.deployTimer = HARDPOINT_TRANSITION_TICKS;
  asset.targetX = asset.x;
  asset.targetY = asset.y;
  asset.state = ASSET_IDLE;
  asset.driveThrottle = 0;
  asset.driveTurn = 0;
  next.events.push({ type: "hardpoint_deploying", assetId: asset.id });
  return next;
}

function applyUndeploy(next, command) {
  const { asset, err } = hardpointSeat(next, command);
  if (err) return reject(next, command, err);
  if (asset.deployed !== 1) return reject(next, command, "not deployed");
  asset.deployed = 0;
  asset.deployTimer = HARDPOINT_TRANSITION_TICKS;
  next.events.push({ type: "hardpoint_undeploying", assetId: asset.id });
  return next;
}

// 11L: direct control — store the seat's drive intent on its asset.""")
patch("engine/reducer.js",
"""    case CMD_DRIVE: return applyDrive(next, command);""",
"""    case CMD_DRIVE: return applyDrive(next, command);
    case CMD_DEPLOY_HARDPOINT: return applyDeployHardpoint(next, command);
    case CMD_UNDEPLOY: return applyUndeploy(next, command);""")

# Transition countdown + activation event, before the movement loop.
patch("engine/reducer.js",
"""  for (const asset of next.assets) {
    if (asset.suppressedTimer > 0) asset.suppressedTimer -= 1;
    if (asset.reloadTimer > 0) asset.reloadTimer -= 1; // 8E""",
"""  for (const asset of next.assets) {
    if (asset.suppressedTimer > 0) asset.suppressedTimer -= 1;
    if (asset.reloadTimer > 0) asset.reloadTimer -= 1; // 8E
    // 12B: hardpoint legs working — immobile; announce completion.
    if (asset.deployTimer > 0) {
      asset.deployTimer -= 1;
      if (asset.deployTimer === 0) {
        next.events.push({
          type: asset.deployed === 1 ? "hardpoint_active" : "hardpoint_stowed",
          assetId: asset.id,
        });
      }
      continue;
    }
    if (asset.deployed === 1) continue; // 12B: hardpoints hold their ground""")

# Move/drive refuse while deployed or transitioning.
patch("engine/reducer.js",
"""  asset.targetX = cellToWorld(command.targetCellX);
  asset.targetY = cellToWorld(command.targetCellY);
  asset.state = ASSET_MOVING;""",
"""  if (asset.deployed === 1 || asset.deployTimer > 0) {
    return reject(next, command, "deployed — undeploy to move"); // 12B
  }
  asset.targetX = cellToWorld(command.targetCellX);
  asset.targetY = cellToWorld(command.targetCellY);
  asset.state = ASSET_MOVING;""")
patch("engine/reducer.js",
"""  asset.driveThrottle = command.throttle;
  asset.driveTurn = command.turn;""",
"""  if ((asset.deployed === 1 || asset.deployTimer > 0) &&
      (command.throttle !== 0 || command.turn !== 0)) {
    return reject(next, command, "deployed — undeploy to move"); // 12B
  }
  asset.driveThrottle = command.throttle;
  asset.driveTurn = command.turn;""")

# Fire refuses mid-transition (guns cold while the legs work).
patch("engine/reducer.js",
"""  if (attacker.state === ASSET_DISABLED || attacker.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  // 11F (Q9): shelling infrastructure.""",
"""  if (attacker.state === ASSET_DISABLED || attacker.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  if (attacker.deployTimer > 0) return reject(next, command, "still transitioning"); // 12B
  // 11F (Q9): shelling infrastructure.""")

# Disablement stows the hardpoint bookkeeping.
patch("engine/reducer.js",
"""  target.driveThrottle = 0;
  target.driveTurn = 0; // 11L: a wreck holds no wheel""",
"""  target.driveThrottle = 0;
  target.driveTurn = 0; // 11L: a wreck holds no wheel
  target.deployed = 0;
  target.deployTimer = 0; // 12B: wrecked legs fold""")

# ── hashing (snapshot + 1A twin) + helpers + views ───────────────────────────
for p in ["engine/snapshot.js", "test/milestone1a.test.js"]:
    patch(p,
"""    w.writeI32LE(a.driveThrottle ?? 0); w.writeI32LE(a.driveTurn ?? 0); // added 11L""",
"""    w.writeI32LE(a.driveThrottle ?? 0); w.writeI32LE(a.driveTurn ?? 0); // added 11L
    w.writeU8(a.deployed ?? 0); w.writeU8(a.deployTimer ?? 0); // added 12B""")
patch("test/helpers.js",
"""    driveThrottle: spec.driveThrottle ?? 0, driveTurn: spec.driveTurn ?? 0, // 11L""",
"""    driveThrottle: spec.driveThrottle ?? 0, driveTurn: spec.driveTurn ?? 0, // 11L
    deployed: spec.deployed ?? 0, deployTimer: spec.deployTimer ?? 0, // 12B""")
patch("engine/view.js",
"""      driveThrottle: a.driveThrottle, driveTurn: a.driveTurn, // 11L""",
"""      driveThrottle: a.driveThrottle, driveTurn: a.driveTurn, // 11L
      deployed: a.deployed, deployTimer: a.deployTimer, // 12B""")
patch("engine/view.js",
"""    .map((a) => ({ id: a.id, type: a.type, team: a.team, state: a.state, x: a.x, y: a.y, heading: a.heading }));""",
"""    .map((a) => ({
      id: a.id, type: a.type, team: a.team, state: a.state,
      x: a.x, y: a.y, heading: a.heading,
      deployed: a.deployed, // 12B: a raised hardpoint is externally obvious
    }));""")

# ── resolver name ────────────────────────────────────────────────────────────
patch("client/js/asset_resolver.js",
"""const CHASSIS_NAMES = { 0: "tank", 1: "scout", 2: "artillery", 3: "logistics", 4: "carrier", 5: "bike", 6: "mortar" };""",
"""const CHASSIS_NAMES = { 0: "tank", 1: "scout", 2: "artillery", 3: "logistics", 4: "carrier", 5: "bike", 6: "mortar", 7: "sentinel" };""")
print("12B engine patched")
