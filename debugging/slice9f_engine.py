# 9F: authoritative heading + turn-rate movement. Integer-only: headings in
# brads (0-255, 0=east, 64=south), 16-direction fixed-point velocity table.

# units: per-chassis turn rate (brads/tick)
p = "engine/units.js"
src = open(p).read()
src = src.replace("reloadTicks: 15, canTow: false, canCarryStandard: false, capacity: 0,",
                  "reloadTicks: 15, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 8,")
src = src.replace("reloadTicks: 8, canTow: false, canCarryStandard: false, capacity: 0,",
                  "reloadTicks: 8, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 14,")
src = src.replace("reloadTicks: 40, canTow: false, canCarryStandard: false, capacity: 0,",
                  "reloadTicks: 40, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 5,")
src = src.replace("canTow: true, canCarryStandard: false, capacity: 0,",
                  "canTow: true, canCarryStandard: false, capacity: 0, turnRate: 10,")
src = src.replace("canTow: false, canCarryStandard: true, capacity: 2,",
                  "canTow: false, canCarryStandard: true, capacity: 2, turnRate: 6,")
open(p, "w").write(src)

# state: heading field (brads); team A faces east (0), team B west (128)
p = "engine/state.js"
src = open(p).read()
src = src.replace("""function makeFieldAsset(id, type, team, cellX, cellY) {
  const x = cellToWorld(cellX);
  const y = cellToWorld(cellY);
  return {
    id, type, team, state: ASSET_IDLE,
    x, y, targetX: x, targetY: y,""",
"""function makeFieldAsset(id, type, team, cellX, cellY) {
  const x = cellToWorld(cellX);
  const y = cellToWorld(cellY);
  return {
    id, type, team, state: ASSET_IDLE,
    x, y, targetX: x, targetY: y,
    heading: team === 1 ? 128 : 0, // brads: A faces east, B faces west (9F)""")
open(p, "w").write(src)

# helpers default heading
p = "test/helpers.js"
src = open(p).read()
src = src.replace("""    id, type: spec.type ?? 0, team: spec.team ?? 0, state: spec.state ?? ASSET_IDLE,
    x, y,""",
"""    id, type: spec.type ?? 0, team: spec.team ?? 0, state: spec.state ?? ASSET_IDLE,
    x, y,
    heading: spec.heading ?? ((spec.team ?? 0) === 1 ? 128 : 0),""")
open(p, "w").write(src)

# hash: heading u8
for f in ["engine/snapshot.js", "test/milestone1a.test.js"]:
    src = open(f).read()
    src = src.replace("w.writeU8(a.reloadTimer); // added 8E",
                      "w.writeU8(a.reloadTimer); // added 8E\n    w.writeU8(a.heading); // added 9F")
    open(f, "w").write(src)

# reducer: heading-based movement
p = "engine/reducer.js"
src = open(p).read()
src = src.replace("""function stepAsset(asset, map, supplied, carrying, towing) {
  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  if (cellX < 0 || cellX >= map.width || cellY < 0 || cellY >= map.height) return;

  const terrain = map.cells[cellY * map.width + cellX];
  let step = floorDivI32(getUnitStats(asset.type).speed * speedMultiplier(terrain), 256);
  if (!supplied) step = floorDivI32(step, 2); // out of supply: half speed (3B)
  if (carrying) step = floorDivI32(step * CARRIER_SPEED_NUM, CARRIER_SPEED_DEN); // 8B
  if (towing) step = floorDivI32(step * TOW_SPEED_NUM, TOW_SPEED_DEN); // 8D
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
}""",
"""// 9F: heading-based movement. Headings are brads (0-255, 0 = +x east,
// 64 = +y south). Vehicles pivot in place toward the bearing (per-chassis
// turnRate brads/tick), then drive along one of 16 fixed directions with a
// fixed-point velocity table. Pure integer math.
const DIR_COS = [256, 237, 181, 98, 0, -98, -181, -237, -256, -237, -181, -98, 0, 98, 181, 237];
const DIR_SIN = [0, 98, 181, 237, 256, 237, 181, 98, 0, -98, -181, -237, -256, -237, -181, -98];

// Sector 0..15 of the vector (dx, dy) using rational tan boundaries.
function bearing16(dx, dy) {
  const ax = absI32(dx);
  const ay = absI32(dy);
  // Octant sectors via |dy|/|dx| against tan(11.25/33.75/56.25/78.75) deg.
  let sector;
  if (ay * 256 <= ax * 51) sector = 0;
  else if (ay * 256 <= ax * 171) sector = 1;
  else if (ax * 256 > ay * 171) sector = 2;
  else if (ax * 256 > ay * 51) sector = 3;
  else sector = 4;
  // Map octant sector to the full 16 directions by quadrant.
  let dir;
  if (dx >= 0 && dy >= 0) dir = sector;              // E..S
  else if (dx < 0 && dy >= 0) dir = 8 - sector;      // S..W
  else if (dx < 0 && dy < 0) dir = 8 + sector;       // W..N
  else dir = (16 - sector) % 16;                     // N..E
  return dir;
}

function turnToward(heading, desiredBrads, turnRate) {
  let diff = (desiredBrads - heading) & 255;
  if (diff > 128) diff -= 256; // shortest arc in [-128, 127]
  if (absI32(diff) <= turnRate) return desiredBrads;
  return (heading + (diff > 0 ? turnRate : -turnRate)) & 255;
}

function stepAsset(asset, map, supplied, carrying, towing) {
  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  if (cellX < 0 || cellX >= map.width || cellY < 0 || cellY >= map.height) return;

  const stats = getUnitStats(asset.type);
  const terrain = map.cells[cellY * map.width + cellX];
  let step = floorDivI32(stats.speed * speedMultiplier(terrain), 256);
  if (!supplied) step = floorDivI32(step, 2); // out of supply: half speed (3B)
  if (carrying) step = floorDivI32(step * CARRIER_SPEED_NUM, CARRIER_SPEED_DEN); // 8B
  if (towing) step = floorDivI32(step * TOW_SPEED_NUM, TOW_SPEED_DEN); // 8D
  if (step <= 0) return;

  const dx = asset.targetX - asset.x;
  const dy = asset.targetY - asset.y;

  // Close enough: snap and stop (prevents orbiting a near target).
  if (absI32(dx) + absI32(dy) <= step) {
    asset.x = asset.targetX;
    asset.y = asset.targetY;
    asset.state = ASSET_IDLE;
    return;
  }

  const desired = bearing16(dx, dy) * 16;
  asset.heading = turnToward(asset.heading, desired, stats.turnRate);

  // Facing too far off the bearing: pivot in place this tick.
  let off = (desired - asset.heading) & 255;
  if (off > 128) off = 256 - off;
  if (off > 32) return;

  const dir = (floorDivI32(asset.heading + 8, 16)) & 15;
  asset.x += floorDivI32(step * DIR_COS[dir], 256);
  asset.y += floorDivI32(step * DIR_SIN[dir], 256);

  if (asset.x === asset.targetX && asset.y === asset.targetY) {
    asset.state = ASSET_IDLE;
  }
}""")
open(p, "w").write(src)

# views: expose authoritative heading on both friendly and enemy records
p = "engine/view.js"
src = open(p).read()
src = src.replace("      towedBy: a.towedBy, recoverTimer: a.recoverTimer,\n      reloadTimer: a.reloadTimer,",
                  "      towedBy: a.towedBy, recoverTimer: a.recoverTimer,\n      reloadTimer: a.reloadTimer,\n      heading: a.heading,")
src = src.replace('.map((a) => ({ id: a.id, type: a.type, team: a.team, state: a.state, x: a.x, y: a.y }));',
                  '.map((a) => ({ id: a.id, type: a.type, team: a.team, state: a.state, x: a.x, y: a.y, heading: a.heading }));')
open(p, "w").write(src)

# client: prefer authoritative heading (brads) over derived motion heading
p = "client/js/client.js"
src = open(p).read()
src = src.replace("""  // 4D headings, smoothed: axis-major movement flips 90 degrees near
  // diagonals, so turn gradually instead of snapping (playtest 3 fix).
  if (typeof a.heading === "number") {
    const target = -a.heading;""",
"""  // 9F: the engine now owns headings (brads 0-255). Convert and smooth the
  // last visual step; fall back to motion-derived heading for old snapshots.
  const brads = typeof a.heading === "number" && a.heading >= 0 && a.heading <= 255
    ? a.heading : null;
  {
    const target = brads !== null ? -(brads * Math.PI * 2) / 256 : null;""")
src = src.replace("""    const prev = mesh.userData.smoothedHeading ?? target;
    const maxStep = TURN_RATE_RAD_PER_SEC / 60;
    mesh.userData.smoothedHeading = smoothHeading(prev, target, maxStep);
    mesh.rotation.y = mesh.userData.smoothedHeading;
  }""",
"""    if (target !== null) {
      const prev = mesh.userData.smoothedHeading ?? target;
      const maxStep = TURN_RATE_RAD_PER_SEC / 60;
      mesh.userData.smoothedHeading = smoothHeading(prev, target, maxStep);
      mesh.rotation.y = mesh.userData.smoothedHeading;
    }
  }""")
open(p, "w").write(src)

# roster contract: turnRate explicit
p = "test/roster_gaps.test.js"
src = open(p).read()
src = src.replace('for (const field of ["speed", "range", "minRange", "hp", "damage", "reloadTicks"]) {',
                  'for (const field of ["speed", "range", "minRange", "hp", "damage", "reloadTicks", "turnRate"]) {')
open(p, "w").write(src)
print("9F engine done")
