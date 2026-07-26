import json, re

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

# helpers: sandbox assets get mine racks like real ones
patch("test/helpers.js",
"""    aboard1: spec.aboard1 ?? -1, aboard2: spec.aboard2 ?? -1,""",
"""    aboard1: spec.aboard1 ?? -1, aboard2: spec.aboard2 ?? -1,
    minesLeft: spec.minesLeft ?? ((spec.type ?? 0) === 0 ? 2 : 0), // 9E""")

# 3A pins: the explicit contract grows two flags
patch("test/milestone3a.test.js",
"""    id: 0, name: "tank", speed: 32, range: 1280, minRange: 0, hp: 100, damage: 20, indirect: false, reloadTicks: 15, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 8,
  });""",
"""    id: 0, name: "tank", speed: 32, range: 1280, minRange: 0, hp: 100, damage: 20, indirect: false, reloadTicks: 15, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 8,
    canMine: true, canClearMines: false, // 9E: only the tank lays mines
  });""")

# 9A carrier pin grows the same two flags
patch("test/milestone9a.test.js",
"""    canTow: false, canCarryStandard: true, capacity: 2, turnRate: 6,
  });""",
"""    canTow: false, canCarryStandard: true, capacity: 2, turnRate: 6,
    canMine: false, canClearMines: false,
  });""")
print("test pins patched")
