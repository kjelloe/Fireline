# Slice 11R: the Scout Bike (prompt 22). Twice a scout's road presence,
# dies to anything, and CANNOT capture or contest relays — speed-as-armor
# recon that sees the war but can't hold it. Also introduces the explicit
# `canCapture` flag (true on every other chassis) and the `siege` flag
# (artillery only — groundwork for the mortar, per ruling Q9).

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── units.js: new chassis + two new explicit flags on everyone ───────────────
patch("engine/units.js",
"""export const UNIT_CARRIER = 4;""",
"""export const UNIT_CARRIER = 4;
export const UNIT_BIKE = 5;    // 11R: scout bike""")
patch("engine/units.js",
"""    heavy: true, // 11N: too wide for woodland paths — crosses at rough speed""",
"""    heavy: true, // 11N: too wide for woodland paths — crosses at rough speed
    canCapture: true, siege: false, // 11R""")
patch("engine/units.js",
"""    heavy: false, // 11N: paths are a scout's home ground""",
"""    heavy: false, // 11N: paths are a scout's home ground
    canCapture: true, siege: false, // 11R""")
src = open("engine/units.js").read()
assert src.count("    heavy: false, // 11N\n") == 3
# artillery gets siege: true; logistics/carrier false. Artillery block is the
# first of the three plain "heavy: false, // 11N" lines.
open("engine/units.js", "w").write(src.replace(
"""    heavy: false, // 11N
  }),
  // Spec roster middle path""",
"""    heavy: false, // 11N
    canCapture: true, siege: true, // 11R: ONLY artillery breaches sites (Q9)
  }),
  // Spec roster middle path""", 1))
patch("engine/units.js",
"""    heavy: false, // 11N
    canMine: false, canClearMines: true, // 9E: trucks clear marked mines""",
"""    heavy: false, // 11N
    canCapture: true, siege: false, // 11R
    canMine: false, canClearMines: true, // 9E: trucks clear marked mines""")
patch("engine/units.js",
"""    heavy: false, // 11N
  }),
});""",
"""    heavy: false, // 11N
    canCapture: true, siege: false, // 11R
  }),
  // 11R (prompt 22): the Scout Bike — a courier that outruns everything,
  // dies to anything, and can neither capture nor contest a relay. It
  // SEES the war; it cannot HOLD it.
  [UNIT_BIKE]: Object.freeze({
    id: UNIT_BIKE, name: "bike",
    speed: 72, range: 768, minRange: 0, hp: 30, damage: 5, indirect: false, reloadTicks: 10,
    canTow: false, canCarryStandard: false, capacity: 0, turnRate: 20,
    canMine: false, canClearMines: false,
    heavy: false,
    canCapture: false, siege: false,
  }),
});""")

# ── capture pass + capturer roles: bikes are ghosts to the flag ──────────────
patch("engine/reducer.js",
"""    const present = new Map(); // siteId -> bitmask of teams standing on it
    for (const asset of next.assets) {
      const site = captureCheck(next, asset.id);
      if (site) present.set(site.id, (present.get(site.id) ?? 0) | (1 << asset.team));
    }""",
"""    const present = new Map(); // siteId -> bitmask of teams standing on it
    for (const asset of next.assets) {
      if (!getUnitStats(asset.type).canCapture) continue; // 11R: bikes are ghosts here
      const site = captureCheck(next, asset.id);
      if (site) present.set(site.id, (present.get(site.id) ?? 0) | (1 << asset.team));
    }""")
patch("engine/ai_regency.js",
"""        for (const [operatorId] of [...controlled.entries()].sort((a, b) => a[0] - b[0])) {
          const op = state.operators[operatorId];
          if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
          const a = state.assets[op.assetId];
          if (!a || a.team !== team || a.operatorId !== operatorId || isWreck(a)) continue;""",
"""        for (const [operatorId] of [...controlled.entries()].sort((a, b) => a[0] - b[0])) {
          const op = state.operators[operatorId];
          if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
          const a = state.assets[op.assetId];
          if (!a || a.team !== team || a.operatorId !== operatorId || isWreck(a)) continue;
          if (!getUnitStats(a.type).canCapture) continue; // 11R: bikes can't be capturers""")

# ── siege flag replaces the indirect gate on site-breaching (Q9) ─────────────
patch("engine/reducer.js",
"""    if (!getUnitStats(attacker.type).indirect) {
      return reject(next, command, "cannot breach sites");
    }""",
"""    if (!getUnitStats(attacker.type).siege) { // 11R: explicit, artillery-only
      return reject(next, command, "cannot breach sites");
    }""")

# ── fielding: one garage reserve tank per team becomes a bike ────────────────
patch("engine/state.js",
"""const RESERVE_TYPES = [4, 3, 1, 0, 0, 1, 2, 3, 2, 3, 0, 4];""",
"""// 11R: garage slot idx 4 (ids 12 / 24) traded from tank to Scout Bike.
// Indices 0-3 are AI-paired (assets 8-11 / 20-23) — never reordered.
const RESERVE_TYPES = [4, 3, 1, 0, 5, 1, 2, 3, 2, 3, 0, 4];""")

# ── resolver + art naming ────────────────────────────────────────────────────
patch("client/js/asset_resolver.js",
"""const CHASSIS_NAMES = { 0: "tank", 1: "scout", 2: "artillery", 3: "logistics", 4: "carrier" };""",
"""const CHASSIS_NAMES = { 0: "tank", 1: "scout", 2: "artillery", 3: "logistics", 4: "carrier", 5: "bike" };""")
print("11R engine patched")
