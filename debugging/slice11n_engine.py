# Slice 11N: PATH terrain (prompt 20 Q22). Dirt roads / woodland trails:
# slower than road, faster than rough — for every chassis EXCEPT the tank
# (narrow trails don't help a heavy hull; tanks cross them at rough
# speed). First per-chassis terrain interaction: speedMultiplier grows an
# explicit `heavy` stat flag.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── mapgen: the new terrain id ───────────────────────────────────────────────
patch("engine/mapgen.js",
"""export const T_BLOCKING = 4;""",
"""export const T_BLOCKING = 4;
export const T_PATH = 5; // 11N: dirt road / woodland trail""")

# ── terrain: per-chassis multiplier ──────────────────────────────────────────
patch("engine/terrain.js",
"""// engine/terrain.js — terrain speed multipliers (1F)

import { T_OPEN, T_ROAD, T_FOREST, T_ROUGH, T_BLOCKING } from './mapgen.js';

// Multipliers as fixed-point integers (1.0 = 256)
export const TERRAIN_SPEED = Object.freeze({
  [T_OPEN]:     256,
  [T_ROAD]:     358,   // ~1.4x
  [T_FOREST]:   179,   // ~0.7x
  [T_ROUGH]:    128,   // 0.5x
  [T_BLOCKING]:   0,   // 0.0x
});

export function speedMultiplier(terrainId) {
  return TERRAIN_SPEED[terrainId] ?? 256;
}""",
"""// engine/terrain.js — terrain speed multipliers (1F; 11N per-chassis paths)

import { T_OPEN, T_ROAD, T_FOREST, T_ROUGH, T_BLOCKING, T_PATH } from './mapgen.js';

// Multipliers as fixed-point integers (1.0 = 256)
export const TERRAIN_SPEED = Object.freeze({
  [T_OPEN]:     256,
  [T_ROAD]:     358,   // ~1.4x
  [T_FOREST]:   179,   // ~0.7x
  [T_ROUGH]:    128,   // 0.5x
  [T_BLOCKING]:   0,   // 0.0x
  [T_PATH]:     307,   // ~1.2x — trails beat open ground but not the road
});
// 11N (Q22): a HEAVY chassis gains nothing from narrow trails — it crosses
// them at rough speed. First per-chassis terrain rule; keep it explicit.
export const PATH_SPEED_HEAVY = 128;

export function speedMultiplier(terrainId, stats = null) {
  if (terrainId === T_PATH && stats?.heavy) return PATH_SPEED_HEAVY;
  return TERRAIN_SPEED[terrainId] ?? 256;
}""")

# ── units: the explicit heavy flag on every contract ─────────────────────────
patch("engine/units.js",
"""    canMine: true, canClearMines: false, // 9E: the Assault chassis lays mines""",
"""    canMine: true, canClearMines: false, // 9E: the Assault chassis lays mines
    heavy: true, // 11N: too wide for woodland paths — crosses at rough speed""")
patch("engine/units.js",
"""    canMine: false, canClearMines: false, // 9E: scouts DETECT mines (los pass)""",
"""    canMine: false, canClearMines: false, // 9E: scouts DETECT mines (los pass)
    heavy: false, // 11N: paths are a scout's home ground""")
src = open("engine/units.js").read()
assert src.count("    canMine: false, canClearMines: false,\n") == 2
open("engine/units.js", "w").write(src.replace(
"""    canMine: false, canClearMines: false,
  }),
  // Spec roster middle path""",
"""    canMine: false, canClearMines: false,
    heavy: false, // 11N
  }),
  // Spec roster middle path""", 1))
patch("engine/units.js",
"""    canMine: false, canClearMines: true, // 9E: trucks clear marked mines""",
"""    canMine: false, canClearMines: true, // 9E: trucks clear marked mines
    heavy: false, // 11N""")
src = open("engine/units.js").read()
open("engine/units.js", "w").write(src.replace(
"""    canMine: false, canClearMines: false,
  }),
});""",
"""    canMine: false, canClearMines: false,
    heavy: false, // 11N
  }),
});""", 1))

# ── reducer: both movement paths pass the chassis ────────────────────────────
src = open("engine/reducer.js").read()
assert src.count("stats.speed * speedMultiplier(terrain)") == 2
open("engine/reducer.js", "w").write(
    src.replace("stats.speed * speedMultiplier(terrain)",
                "stats.speed * speedMultiplier(terrain, stats)"))

# ── maps: mirrored paths on both profiles ────────────────────────────────────
# Frontier: two mirrored woodland loops north and south of the road,
# spanning between the relay flanks (x 24..103, mirror-closed range).
patch("engine/frontier_corridor.js",
"""const T_OPEN = 0;
const T_ROAD = 1;
const T_FOREST = 2;
const T_ROUGH = 3;""",
"""const T_OPEN = 0;
const T_ROAD = 1;
const T_FOREST = 2;
const T_ROUGH = 3;
const T_PATH = 5; // 11N""")
patch("engine/frontier_corridor.js",
"""  // Restore the guaranteed cross-map route after clearing operational zones.
  for (const y of p.roadRows) fillRect(cells, 0, y, p.width, 1, T_ROAD);""",
"""  // 11N: mirrored woodland paths — slower flanking routes north and south
  // of the corridor (rows 40/41 and 86/87, x 24..103 = mirror-closed).
  for (const y of [40, 41, 86, 87]) fillRect(cells, 24, y, 80, 1, T_PATH);
  // Restore the guaranteed cross-map route after clearing operational zones.
  for (const y of p.roadRows) fillRect(cells, 0, y, p.width, 1, T_ROAD);""")

# Riverline: paths connect the road to each relay pair (vertical trails at
# the relay columns, both sides — mirror pairs 44<->83).
patch("engine/riverline.js",
"""  // Infrastructure last: the cross-map road, and the three bridges.""",
"""  // 11N: woodland paths from the road up/down to each relay (mirrored
  // columns 44 and 83) — light chassis flank fast, tanks take the road.
  const T_PATH = 5;
  for (const x of [44, 83]) {
    for (let y = 32; y < 62; y++) if (cells[idx(x, y)] !== T_ROAD) cells[idx(x, y)] = T_PATH;
    for (let y = 66; y <= 95; y++) if (cells[idx(x, y)] !== T_ROAD) cells[idx(x, y)] = T_PATH;
  }
  // Infrastructure last: the cross-map road, and the three bridges.""")

# ── clients: a color for paths ───────────────────────────────────────────────
patch("client/js/client.js",
"""const TERRAIN_COLORS = [0x3e5a3e, 0x8a8a72, 0x274427, 0x5e5240, 0x2b2b33];""",
"""const TERRAIN_COLORS = [0x3e5a3e, 0x8a8a72, 0x274427, 0x5e5240, 0x2b2b33, 0x6e5f42]; // 11N: path""")
patch("client/js/replay.js",
"""const TERRAIN_COLORS = ["#3e5a3e", "#8a8a72", "#274427", "#5e5240", "#2b2b33"];""",
"""const TERRAIN_COLORS = ["#3e5a3e", "#8a8a72", "#274427", "#5e5240", "#2b2b33", "#6e5f42"]; // 11N: path""")
print("11N patched")
