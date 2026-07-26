p = "engine/state.js"
src = open(p).read()
src = src.replace("""export function fieldSpawnFor(id) {
  const team = id < 16 ? 0 : 1;
  const local = id % 16;
  if (local < 4) {
    const spawnX = team === 0 ? TEAM_A_SPAWN_X : TEAM_B_SPAWN_X;
    return { team, type: SPAWN_TYPES[local], cellX: spawnX, cellY: SPAWN_ROWS[local] };
  }
  const slot = local - 4;
  const cols = team === 0 ? TEAM_A_RESERVE_COLS : TEAM_B_RESERVE_COLS;
  const col = cols[(slot / RESERVE_ROWS.length) | 0];
  const row = RESERVE_ROWS[slot % RESERVE_ROWS.length];
  return { team, type: RESERVE_TYPES[slot % 12], cellX: col, cellY: row };
}""",
"""export function fieldSpawnFor(id) {
  // Layout: 0-3 team A originals, 4-7 team B originals, 8-19 team A
  // reserves, 20-31 team B reserves (see createFieldAssets).
  if (id < 8) {
    const team = id < 4 ? 0 : 1;
    const slot = id % 4;
    const spawnX = team === 0 ? TEAM_A_SPAWN_X : TEAM_B_SPAWN_X;
    return { team, type: SPAWN_TYPES[slot], cellX: spawnX, cellY: SPAWN_ROWS[slot] };
  }
  const team = id < 20 ? 0 : 1;
  const slot = team === 0 ? id - 8 : id - 20;
  const cols = team === 0 ? TEAM_A_RESERVE_COLS : TEAM_B_RESERVE_COLS;
  const col = cols[(slot / RESERVE_ROWS.length) | 0];
  const row = RESERVE_ROWS[slot % RESERVE_ROWS.length];
  return { team, type: RESERVE_TYPES[slot % 12], cellX: col, cellY: row };
}""")
open(p, "w").write(src)

p = "test/milestone9d.test.js"
src = open(p).read()
src = src.replace("""  // Wreck team A down to 4 operable assets (below the threshold of 6).
  const s = createInitialState(42, "frontier_corridor");
  for (const a of s.assets) {
    if (a.team === 0 && a.id >= 4 && a.id <= 15) {
      a.state = ASSET_DISABLED;
      a.hp = 0;
    }
  }
  return s;""",
"""  // Wreck all 12 team-A reserves (ids 8-19): 4 operable left, below 6.
  const s = createInitialState(42, "frontier_corridor");
  for (const a of s.assets) {
    if (a.team === 0 && a.id >= 8) {
      a.state = ASSET_DISABLED;
      a.hp = 0;
    }
  }
  return s;""")
src = src.replace("""  assert.equal(s.assets[4].state, ASSET_DISABLED, "not yet");

  s = apply(s, { type: "advance_tick" });
  const rebuilt = s.events.find((e) => e.type === "asset_manufactured");
  assert.deepEqual(rebuilt, { type: "asset_manufactured", assetId: 4, team: 0 },
    "lowest wrecked id rebuilds first");
  const spawn = fieldSpawnFor(4);
  assert.equal(s.assets[4].state, ASSET_IDLE);
  assert.equal(s.assets[4].x, cellToWorld(spawn.cellX), "back at original spawn");
  assert.equal(s.assets[4].hp, 50, "half hull");""",
"""  assert.equal(s.assets[8].state, ASSET_DISABLED, "not yet");

  s = apply(s, { type: "advance_tick" });
  const rebuilt = s.events.find((e) => e.type === "asset_manufactured");
  assert.deepEqual(rebuilt, { type: "asset_manufactured", assetId: 8, team: 0 },
    "lowest wrecked id rebuilds first");
  const spawn = fieldSpawnFor(8);
  assert.equal(s.assets[8].state, ASSET_IDLE);
  assert.equal(s.assets[8].x, cellToWorld(spawn.cellX), "back at original spawn");
  assert.equal(s.assets[8].hp, 60, "half of the carrier's 120 hull");""")
src = src.replace("""  s.assets[4].towedBy = 0;      // player rescue in progress
  s.assets[5].recoverTimer = 50; // already in the bay
  for (let i = 0; i < MPG_TICKS; i++) s = apply(s, { type: "advance_tick" });
  const rebuilt = s.events.find((e) => e.type === "asset_manufactured");
  assert.equal(rebuilt.assetId, 6, "skips towed and recovering hulls");""",
"""  s.assets[8].towedBy = 0;      // player rescue in progress
  s.assets[9].recoverTimer = 50; // already in the bay
  for (let i = 0; i < MPG_TICKS; i++) s = apply(s, { type: "advance_tick" });
  const rebuilt = s.events.find((e) => e.type === "asset_manufactured");
  assert.equal(rebuilt.assetId, 10, "skips towed and recovering hulls");""")
src = src.replace("""  s.assets[7].towedBy = -1; // a hull frees up
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.events.find((e) => e.type === "asset_manufactured")?.assetId, 7);""",
"""  s.assets[11].towedBy = -1; // a hull frees up
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.events.find((e) => e.type === "asset_manufactured")?.assetId, 11);""")
open(p, "w").write(src)
print("9D fixed")
