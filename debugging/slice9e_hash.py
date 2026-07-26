def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

for p in ["engine/snapshot.js", "test/milestone1a.test.js"]:
    patch(p,
"""    w.writeU8(a.heading); // added 9F
    w.writeI32LE(a.aboard1); w.writeI32LE(a.aboard2); // added 9B""",
"""    w.writeU8(a.heading); // added 9F
    w.writeI32LE(a.aboard1); w.writeI32LE(a.aboard2); // added 9B
    w.writeU8(a.minesLeft); // added 9E""")
    patch(p,
"""    w.writeI32LE(d.downTicks);
  }""",
"""    w.writeI32LE(d.downTicks);
  }
  w.writeI32LE(state.nextMineId ?? 0); // added 9E
  for (const m of (state.mines ?? [])) {
    w.writeI32LE(m.id); w.writeI32LE(m.team);
    w.writeI32LE(m.cellX); w.writeI32LE(m.cellY);
    w.writeI32LE(m.armTimer); w.writeU8(m.marked);
  }""")
print("hash patched in both")
