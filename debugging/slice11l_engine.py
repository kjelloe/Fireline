# Slice 11L: direct control, all chassis (prompt 16 Q10, prompt 19: "all
# chassis if not much more work" — it isn't: speed/turnRate are already
# per-chassis). Authoritative intent model: the client streams
# throttle/turn intent (-1/0/1), the reducer drives the physics — heading
# turns at the chassis turnRate, forward at chassis speed, reverse at
# half, all existing multipliers (terrain, supply, carrying, towing)
# apply. The Firepower homage mode.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── state: per-asset drive intent (hashed) ───────────────────────────────────
patch("engine/state.js",
"""    materiel: 0, // 11F: one repair-cargo slot (trucks load it in base)
  };""",
"""    materiel: 0, // 11F: one repair-cargo slot (trucks load it in base)
    driveThrottle: 0, driveTurn: 0, // 11L: direct-control intent
  };""")

# ── commands ─────────────────────────────────────────────────────────────────
patch("engine/commands.js",
"""export const CMD_SET_OPTION     = "set_option";   // 11G""",
"""export const CMD_DRIVE          = "drive";        // 11L direct control
export const CMD_SET_OPTION     = "set_option";   // 11G""")
patch("engine/commands.js",
"""    case CMD_SET_OPTION:""",
"""    case CMD_DRIVE: {
      if (!isUint(cmd.operatorId, 31))  return { ok: false, reason: "invalid operatorId" };
      const ok = (v) => v === -1 || v === 0 || v === 1;
      if (!ok(cmd.throttle)) return { ok: false, reason: "invalid throttle" };
      if (!ok(cmd.turn))     return { ok: false, reason: "invalid turn" };
      return { ok: true };
    }

    case CMD_SET_OPTION:""")

# ── reducer: command handler + drive physics in the movement pass ────────────
patch("engine/reducer.js",
"""  CMD_SET_OPTION, CMD_BOARD_CARRIER, CMD_UNBOARD,""",
"""  CMD_SET_OPTION, CMD_BOARD_CARRIER, CMD_UNBOARD, CMD_DRIVE,""")
patch("engine/reducer.js",
"""// 11G: per-seat preference; the only option so far is the rescue autopilot.""",
"""// 11L: direct control — store the seat's drive intent on its asset. Any
// intent cancels the click-move target; zeroing both returns the asset to
// ordinary click-to-move.
function applyDrive(next, command) {
  const operator = next.operators[command.operatorId];
  if (operator.state !== OP_ACTIVE) return reject(next, command, "operator not active");
  if (operator.assetId === -1) return reject(next, command, "no asset selected");
  const asset = next.assets[operator.assetId];
  if (!asset || asset.operatorId !== operator.id) {
    return reject(next, command, "no asset selected");
  }
  if (asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED) {
    return reject(next, command, "asset not operable");
  }
  asset.driveThrottle = command.throttle;
  asset.driveTurn = command.turn;
  if (command.throttle !== 0 || command.turn !== 0) {
    asset.targetX = asset.x;
    asset.targetY = asset.y;
    asset.state = ASSET_IDLE; // direct mode owns the wheel, not the target
  }
  return next;
}

// 11G: per-seat preference; the only option so far is the rescue autopilot.""")

# Drive physics: runs in the movement loop, before target-seeking.
patch("engine/reducer.js",
"""  for (const asset of next.assets) {
    if (asset.suppressedTimer > 0) asset.suppressedTimer -= 1;
    if (asset.reloadTimer > 0) asset.reloadTimer -= 1; // 8E
    if (asset.state !== ASSET_MOVING) continue;
    if (asset.fuel < SUPPLY_MOVE_COST) continue; // stranded until resupplied
    const beforeX = asset.x;
    const beforeY = asset.y;
    stepAsset(
      asset, next.map, inSupply(next, asset),
      assetCarries(next, asset.id) !== null,
      towedWreck(next, asset.id) !== null
    );
    if (asset.x !== beforeX || asset.y !== beforeY) asset.fuel -= SUPPLY_MOVE_COST;
  }""",
"""  for (const asset of next.assets) {
    if (asset.suppressedTimer > 0) asset.suppressedTimer -= 1;
    if (asset.reloadTimer > 0) asset.reloadTimer -= 1; // 8E
    // 11L direct control: intent-driven physics preempts target-seeking.
    if ((asset.driveThrottle !== 0 || asset.driveTurn !== 0) &&
        asset.state !== ASSET_DISABLED && asset.state !== ASSET_SALVAGED) {
      if (asset.fuel < SUPPLY_MOVE_COST) continue; // stranded until resupplied
      const beforeX = asset.x;
      const beforeY = asset.y;
      driveStep(
        asset, next.map, inSupply(next, asset),
        assetCarries(next, asset.id) !== null,
        towedWreck(next, asset.id) !== null
      );
      if (asset.x !== beforeX || asset.y !== beforeY) asset.fuel -= SUPPLY_MOVE_COST;
      continue;
    }
    if (asset.state !== ASSET_MOVING) continue;
    if (asset.fuel < SUPPLY_MOVE_COST) continue; // stranded until resupplied
    const beforeX = asset.x;
    const beforeY = asset.y;
    stepAsset(
      asset, next.map, inSupply(next, asset),
      assetCarries(next, asset.id) !== null,
      towedWreck(next, asset.id) !== null
    );
    if (asset.x !== beforeX || asset.y !== beforeY) asset.fuel -= SUPPLY_MOVE_COST;
  }""")

# driveStep beside stepAsset.
patch("engine/reducer.js",
"""function stepAsset(asset, map, supplied, carrying, towing) {""",
"""// 11L: tank-style direct drive. A/D pivot at the chassis turnRate; W
// drives along the heading at chassis speed, S reverses at half; every
// speed multiplier stepAsset honors applies here too. Map edges clamp.
function driveStep(asset, map, supplied, carrying, towing) {
  const stats = getUnitStats(asset.type);
  if (asset.driveTurn !== 0) {
    asset.heading = (asset.heading + asset.driveTurn * stats.turnRate) & 255;
  }
  if (asset.driveThrottle === 0) return;

  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  if (cellX < 0 || cellX >= map.width || cellY < 0 || cellY >= map.height) return;
  const terrain = map.cells[cellY * map.width + cellX];
  let step = floorDivI32(stats.speed * speedMultiplier(terrain), 256);
  if (!supplied) step = floorDivI32(step, 2);
  if (carrying) step = floorDivI32(step * CARRIER_SPEED_NUM, CARRIER_SPEED_DEN);
  if (towing) step = floorDivI32(step * TOW_SPEED_NUM, TOW_SPEED_DEN);
  if (asset.driveThrottle < 0) step = floorDivI32(step, 2); // reverse gear
  if (step <= 0) return;

  const dir = (floorDivI32(asset.heading + 8, 16)) & 15;
  const sign = asset.driveThrottle < 0 ? -1 : 1;
  const maxX = (map.width - 1) * 256 + 255;
  const maxY = (map.height - 1) * 256 + 255;
  asset.x = Math.min(maxX, Math.max(0, asset.x + sign * floorDivI32(step * DIR_COS[dir], 256)));
  asset.y = Math.min(maxY, Math.max(0, asset.y + sign * floorDivI32(step * DIR_SIN[dir], 256)));
  asset.targetX = asset.x;
  asset.targetY = asset.y;
}

function stepAsset(asset, map, supplied, carrying, towing) {""")

patch("engine/reducer.js",
"""    case CMD_SET_OPTION: return applySetOption(next, command);""",
"""    case CMD_DRIVE: return applyDrive(next, command);
    case CMD_SET_OPTION: return applySetOption(next, command);""")

# A driving seat is not camping (9G) — it is actively at the wheel.
patch("engine/reducer.js",
"""    if (asset.state === ASSET_IDLE && !inSupply(next, asset)) {
      asset.campTicks += 1;
    } else {
      asset.campTicks = 0;
    }""",
"""    const atTheWheel = asset.driveThrottle !== 0 || asset.driveTurn !== 0; // 11L
    if (asset.state === ASSET_IDLE && !atTheWheel && !inSupply(next, asset)) {
      asset.campTicks += 1;
    } else {
      asset.campTicks = 0;
    }""")

# Disablement clears intent (a wreck holds no wheel).
patch("engine/reducer.js",
"""function disableAsset(next, target, scoringTeam) {
  target.state = ASSET_DISABLED;""",
"""function disableAsset(next, target, scoringTeam) {
  target.state = ASSET_DISABLED;
  target.driveThrottle = 0;
  target.driveTurn = 0; // 11L: a wreck holds no wheel""")

# ── hashing (snapshot + 1A twin) ─────────────────────────────────────────────
for p in ["engine/snapshot.js", "test/milestone1a.test.js"]:
    patch(p,
"""    w.writeU8(a.materiel ?? 0); // added 11F""",
"""    w.writeU8(a.materiel ?? 0); // added 11F
    w.writeI32LE(a.driveThrottle ?? 0); w.writeI32LE(a.driveTurn ?? 0); // added 11L""")

# ── helpers ──────────────────────────────────────────────────────────────────
patch("test/helpers.js",
"""    materiel: spec.materiel ?? 0, // 11F""",
"""    materiel: spec.materiel ?? 0, // 11F
    driveThrottle: spec.driveThrottle ?? 0, driveTurn: spec.driveTurn ?? 0, // 11L""")

# ── view: friendly assets expose the intent (own team only) ──────────────────
patch("engine/view.js",
"""      materiel: a.materiel, // 11F""",
"""      materiel: a.materiel, // 11F
      driveThrottle: a.driveThrottle, driveTurn: a.driveTurn, // 11L""")

# ── feedback ─────────────────────────────────────────────────────────────────
patch("client/js/feedback_model.js",
"""  "invalid value": "That setting takes on or off.",""",
"""  "invalid value": "That setting takes on or off.",
  "invalid throttle": "Bad drive input.",
  "invalid turn": "Bad drive input.",""")
print("11L patched")
