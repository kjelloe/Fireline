# Slice 12C: the Outlier Skimmer (designer ruling, prompt 29).
# Riverline Drive: T_WATER joins the terrain set — the riverline river is
# now real water. Normal chassis ford it at a grim 0.25x (passable, so
# the straight-line AI never wedges — impassable water waits for the
# route graph); the amphibious Skimmer crosses at trail speed. Replaces
# the Outliers' garage tank at reserve idx 10 (id 30). No 17th asset.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── terrain: T_WATER ─────────────────────────────────────────────────────────
patch("engine/mapgen.js",
"""export const T_PATH = 5; // 11N: dirt road / woodland trail""",
"""export const T_PATH = 5; // 11N: dirt road / woodland trail
export const T_WATER = 6; // 12C: rivers — grim to ford, home to Skimmers""")
patch("engine/terrain.js",
"""import { T_OPEN, T_ROAD, T_FOREST, T_ROUGH, T_BLOCKING, T_PATH } from './mapgen.js';""",
"""import { T_OPEN, T_ROAD, T_FOREST, T_ROUGH, T_BLOCKING, T_PATH, T_WATER } from './mapgen.js';""")
patch("engine/terrain.js",
"""  [T_PATH]:     307,   // ~1.2x — trails beat open ground but not the road
});""",
"""  [T_PATH]:     307,   // ~1.2x — trails beat open ground but not the road
  [T_WATER]:     64,   // 0.25x — fording is misery (12C); Skimmers fly it
});
// 12C (Riverline Drive): the amphibious chassis treats water as a trail.
export const WATER_SPEED_AMPHIBIOUS = 307;""")
patch("engine/terrain.js",
"""export function speedMultiplier(terrainId, stats = null) {
  if (terrainId === T_PATH && stats?.heavy) return PATH_SPEED_HEAVY;
  return TERRAIN_SPEED[terrainId] ?? 256;
}""",
"""export function speedMultiplier(terrainId, stats = null) {
  if (terrainId === T_PATH && stats?.heavy) return PATH_SPEED_HEAVY;
  if (terrainId === T_WATER && stats?.amphibious) return WATER_SPEED_AMPHIBIOUS; // 12C
  return TERRAIN_SPEED[terrainId] ?? 256;
}""")

# ── riverline: the river is WATER now ────────────────────────────────────────
patch("engine/riverline.js",
"""const T_OPEN = 0;
const T_ROAD = 1;
const T_FOREST = 2;
const T_ROUGH = 3;""",
"""const T_OPEN = 0;
const T_ROAD = 1;
const T_FOREST = 2;
const T_ROUGH = 3;
const T_WATER = 6; // 12C""")
patch("engine/riverline.js",
"""  // The river drowns whatever it crosses (both halves — symmetric band).
  for (const x of p.riverCols) {
    for (let y = 0; y < p.height; y++) cells[idx(x, y)] = T_ROUGH;
  }""",
"""  // The river drowns whatever it crosses (both halves — symmetric band).
  // 12C: real WATER — grim fording for hulls, a highway for Skimmers.
  for (const x of p.riverCols) {
    for (let y = 0; y < p.height; y++) cells[idx(x, y)] = T_WATER;
  }""")

# ── units: the Skimmer + amphibious contract flag everywhere ─────────────────
patch("engine/units.js",
"""export const UNIT_SENTINEL = 7; // 12B: Directorate unique""",
"""export const UNIT_SENTINEL = 7; // 12B: Directorate unique
export const UNIT_SKIMMER = 8;  // 12C: Outlier unique""")
src = open("engine/units.js").read()
src = src.replace("    deployable: false, // 12B",
                  "    deployable: false, // 12B\n    amphibious: false, // 12C")
src = src.replace("""    deployable: true,
    deployedRange: 2048, deployedDamage: 25, deployedReloadTicks: 20,
  }),""",
"""    deployable: true,
    deployedRange: 2048, deployedDamage: 25, deployedReloadTicks: 20,
    amphibious: false, // 12C
  }),""")
open("engine/units.js", "w").write(src)
patch("engine/units.js",
"""  // 11S (prompt 22): the Mortar Carrier""",
"""  // 12C (prompt 29): the Outlier Skimmer — Riverline Drive. A rag-tag
  // airboat: light, fast, and the only hull that treats water as a road.
  // bypass · improvise · exploit neglected routes.
  [UNIT_SKIMMER]: Object.freeze({
    id: UNIT_SKIMMER, name: "skimmer",
    speed: 56, range: 896, minRange: 0, hp: 45, damage: 8, indirect: false, reloadTicks: 12,
    canTow: false, canCarryStandard: false, capacity: 0, turnRate: 16,
    canMine: false, canClearMines: false,
    heavy: false,
    canCapture: true, siege: false,
    deployable: false,
    amphibious: true,
  }),
  // 11S (prompt 22): the Mortar Carrier""")

# ── fielding: Outliers' idx-10 tank becomes the Skimmer ──────────────────────
patch("engine/state.js",
"""  [4, 3, 1, 0, 5, 1, 6, 3, 2, 3, 0, 4], // team 1: The Outliers (Skimmer in 12C)""",
"""  [4, 3, 1, 0, 5, 1, 6, 3, 2, 3, 8, 4], // team 1: The Outliers — Skimmer""")

# ── resolver + clients terrain color ─────────────────────────────────────────
patch("client/js/asset_resolver.js",
"""const CHASSIS_NAMES = { 0: "tank", 1: "scout", 2: "artillery", 3: "logistics", 4: "carrier", 5: "bike", 6: "mortar", 7: "sentinel" };""",
"""const CHASSIS_NAMES = { 0: "tank", 1: "scout", 2: "artillery", 3: "logistics", 4: "carrier", 5: "bike", 6: "mortar", 7: "sentinel", 8: "skimmer" };""")
patch("client/js/client.js",
"""const TERRAIN_COLORS = [0x3e5a3e, 0x8a8a72, 0x274427, 0x5e5240, 0x2b2b33, 0x6e5f42]; // 11N: path""",
"""const TERRAIN_COLORS = [0x3e5a3e, 0x8a8a72, 0x274427, 0x5e5240, 0x2b2b33, 0x6e5f42, 0x2a4a66]; // 11N path, 12C water""")
patch("client/js/replay.js",
"""const TERRAIN_COLORS = ["#3e5a3e", "#8a8a72", "#274427", "#5e5240", "#2b2b33", "#6e5f42"]; // 11N: path""",
"""const TERRAIN_COLORS = ["#3e5a3e", "#8a8a72", "#274427", "#5e5240", "#2b2b33", "#6e5f42", "#2a4a66"]; // 11N path, 12C water""")

# props: water props key on T_WATER now (12C), reeds on the banks stay.
patch("client/js/props_model.js",
"""        } else if (terrain === 3) {
          // The river itself: water sheen tiles, denser than rocks ever were.
          props.push({ kind: "water", x: cx + 0.5, y: cy + 0.5, scale: 1, rotation: 0 });""",
"""        } else if (terrain === 6) { // 12C: T_WATER
          // The river itself: water sheen tiles, denser than rocks ever were.
          props.push({ kind: "water", x: cx + 0.5, y: cy + 0.5, scale: 1, rotation: 0 });""")

# frontier countTerrain grows to 7 slots.
patch("engine/frontier_corridor.js",
"""export function countTerrain(cells) {
  const counts = [0, 0, 0, 0, 0, 0]; // 11N: index 5 = path
  for (const cell of cells) counts[cell]++;
  return counts;
}""",
"""export function countTerrain(cells) {
  const counts = [0, 0, 0, 0, 0, 0, 0]; // 11N: 5 = path; 12C: 6 = water
  for (const cell of cells) counts[cell]++;
  return counts;
}""")
print("12C engine patched")
