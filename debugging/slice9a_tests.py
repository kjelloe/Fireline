# 9A test fallout: takers become carriers (type 4), fielding pins update,
# strip tile count, 3A pins, ai_objective doctrine rewrite, objective hint.

# --- milestone3a ---
p = "test/milestone3a.test.js"
src = open(p).read()
src = src.replace('id: 0, name: "tank", speed: 32, range: 1280, minRange: 0, hp: 100, damage: 20, indirect: false, reloadTicks: 15, canTow: false,',
                  'id: 0, name: "tank", speed: 32, range: 1280, minRange: 0, hp: 100, damage: 20, indirect: false, reloadTicks: 15, canTow: false, canCarryStandard: false, capacity: 0,')
src = src.replace("""    assert.equal(teamAssets.filter((a) => a.type === 0).length, 5, "5 tanks");
    assert.equal(teamAssets.filter((a) => a.type === 1).length, 4, "4 scouts");
    assert.equal(teamAssets.filter((a) => a.type === 2).length, 4, "4 artillery");
    assert.equal(teamAssets.filter((a) => a.type === 3).length, 3, "3 logistics trucks");""",
"""    assert.equal(teamAssets.filter((a) => a.type === 0).length, 5, "5 tanks");
    assert.equal(teamAssets.filter((a) => a.type === 1).length, 3, "3 scouts");
    assert.equal(teamAssets.filter((a) => a.type === 2).length, 3, "3 artillery");
    assert.equal(teamAssets.filter((a) => a.type === 3).length, 3, "3 logistics trucks");
    assert.equal(teamAssets.filter((a) => a.type === 4).length, 2, "2 command carriers");""")
open(p, "w").write(src)

# --- 8A/8B/8C: takers become carriers ---
p = "test/milestone8a.test.js"
src = open(p).read()
src = src.replace("""  const s = sandbox(
    [{ team: 0, cellX: 10 }],
    [], { standards: [{ team: 0, cellX: 10 }, { team: 1, cellX: 10 }] }
  );
  const takeable = standardTakeableBy(s, s.assets[0]);""",
"""  const s = sandbox(
    [{ team: 0, cellX: 10, type: 4 }],
    [], { standards: [{ team: 0, cellX: 10 }, { team: 1, cellX: 10 }] }
  );
  const takeable = standardTakeableBy(s, s.assets[0]);""")
src = src.replace("""  const s = sandbox(
    [{ team: 0, cellX: 10, state: 2, hp: 0 }],
    [], { standards: [{ team: 0, cellX: 10, status: STD_DROPPED }, { team: 1, cellX: 10 }] }
  );""",
"""  const s = sandbox(
    [{ team: 0, cellX: 10, type: 4, state: 2, hp: 0 }],
    [], { standards: [{ team: 0, cellX: 10, status: STD_DROPPED }, { team: 1, cellX: 10 }] }
  );""")
src = src.replace("""      standards: [{ team: 0, cellX: 2 }, { team: 1, cellX: 1, cellY: 1, status: STD_CARRIED, carrierAssetId: 0 }],
    }
  );
  assert.equal(canScore(inZone, inZone.assets[0]), true);""",
"""      standards: [{ team: 0, cellX: 2 }, { team: 1, cellX: 1, cellY: 1, status: STD_CARRIED, carrierAssetId: 0 }],
    }
  );
  assert.equal(canScore(inZone, inZone.assets[0]), true);""")
open(p, "w").write(src)

p = "test/milestone8b.test.js"
src = open(p).read()
# every team-0 "taker" asset gains type 4
src = src.replace("[{ team: 0, cellX: 8 }],", "[{ team: 0, cellX: 8, type: 4 }],")
src = src.replace("[{ team: 0, cellX: 10 }],", "[{ team: 0, cellX: 10, type: 4 }],")
src = src.replace("[{ team: 0, cellX: 10, state: ASSET_MOVING, targetX: cellToWorld(30) }],",
                  "[{ team: 0, cellX: 10, type: 4, state: ASSET_MOVING, targetX: cellToWorld(30) }],")
src = src.replace("""      { team: 0, cellX: 10, hp: 20 },  // carrier, one shot from death""",
"""      { team: 0, cellX: 10, type: 4, hp: 20 },  // carrier, one shot from death""")
src = src.replace('assert.equal(s.assets[0].x - x0, 24, "tank 32 * 0.75 carrier penalty");',
                  'assert.equal(s.assets[0].x - x0, 18, "carrier 24 * 0.75 carrying penalty");')
src = src.replace("[{ team: 0, cellX: 1, cellY: 1 }], // already inside zone A, standing on enemy standard",
                  "[{ team: 0, cellX: 1, cellY: 1, type: 4 }], // carrier inside zone A, on the enemy standard")
src = src.replace("[{ team: 0, cellX: 3, cellY: 0 }],", "[{ team: 0, cellX: 3, cellY: 0, type: 4 }],")
open(p, "w").write(src)

p = "test/milestone8c.test.js"
src = open(p).read()
src = src.replace("    [{ team: 0, cellX: 1, cellY: 1 }],", "    [{ team: 0, cellX: 1, cellY: 1, type: 4 }],")
src = src.replace("""      { team: 0, cellX: 1, cellY: 1 },
      { team: 1, cellX: 30, state: 2, hp: 0 }, // team 1 also fully wrecked""",
"""      { team: 0, cellX: 1, cellY: 1, type: 4 },
      { team: 1, cellX: 30, state: 2, hp: 0 }, // team 1 also fully wrecked""")
open(p, "w").write(src)

# --- phase8_gaps: role exclusivity replaces the tow+carry combos ---
p = "test/phase8_gaps.test.js"
src = open(p).read()
src = src.replace('''test("phase8 unit: carrier and tow penalties stack (40 → 30 → 15)", () => {
  // Base rect sits 20 cells south: close enough for supply, far enough that
  // the towed wreck is NOT "at base" (which would start repair and cut the tow).
  let s = sandbox(
    [
      { team: 0, cellX: 10, type: 3, state: ASSET_MOVING, targetX: cellToWorld(40) },
      { team: 0, cellX: 11, state: ASSET_DISABLED, hp: 0 },
    ],
    [],
    {
      bases: [{ team: 0, x: 0, y: 20, width: 64, height: 44 }],
      standards: [{ team: 0, cellX: 1, status: STD_DROPPED }, { team: 1, cellX: 10 }],
    }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: 1 });
  s = apply(s, { type: "advance_tick" }); // picks up standard while towing
  assert.equal(s.standards[1].status, STD_CARRIED);
  const x0 = s.assets[0].x;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].x - x0, 15, "truck 40 * 0.75 carrier * 0.5 tow = 15");
});''',
'''test("phase8 unit: roles are exclusive — trucks tow, carriers carry (9A)", () => {
  // Tow+carry stacking died with 9A: the truck cannot take a standard and the
  // carrier cannot tow. Pin both exclusions and the carrier carrying penalty.
  let s = sandbox(
    [
      { team: 0, cellX: 10, type: 3, state: ASSET_MOVING, targetX: cellToWorld(40) }, // truck
      { team: 0, cellX: 12, type: 4, state: ASSET_MOVING, targetX: cellToWorld(40), cellY: 4 }, // carrier
      { team: 0, cellX: 11, state: ASSET_DISABLED, hp: 0 }, // wreck
    ],
    [],
    {
      bases: [{ team: 0, x: 0, y: 20, width: 64, height: 44 }],
      standards: [{ team: 0, cellX: 1, status: STD_DROPPED }, { team: 1, cellX: 10 }],
    }
  );
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.standards[1].status, STD_DROPPED,
    "truck drove over the enemy standard and could NOT take it");

  s = joinAndSelect(s, 0, 0, 1); // human takes the carrier
  const rejected = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: 2 });
  assert.equal(rejected.events[0].reason, "needs a logistics truck", "carrier cannot tow");

  // Carrier carrying penalty: 24 * 0.75 = 18.
  s.standards[1].x = s.assets[1].x;
  s.standards[1].y = s.assets[1].y;
  s = apply(s, { type: "advance_tick" }); // carrier picks up
  assert.equal(s.standards[1].carrierAssetId, 1);
  const x0 = s.assets[1].x;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[1].x - x0, 18, "carrier 24 * 0.75 = 18");
});''')
src = src.replace("""    [{ team: 0, cellX: 10 }, { team: 0, cellX: 10 }],""",
"""    [{ team: 0, cellX: 10, type: 4 }, { team: 0, cellX: 10, type: 4 }],""")
src = src.replace('''test("phase8 component: disabling a tower-carrier drops the flag AND cuts the tow", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 10, type: 3, hp: 20 },              // carrier+tower (truck)
      { team: 0, cellX: 11, state: ASSET_DISABLED, hp: 0 }, // wreck in tow
      { team: 1, cellX: 12 },                                // gunner
    ],
    [], { standards: [{ team: 0, cellX: 1, status: STD_DROPPED }, { team: 1, cellX: 10 }] }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: 1 });
  s = apply(s, { type: "advance_tick" }); // pickup
  s = joinAndSelect(s, 1, 1, 2);
  s = apply(s, { type: "fire_order", operatorId: 1, targetAssetId: 0 });
  assert.equal(s.assets[0].state, ASSET_DISABLED);
  assert.equal(s.standards[1].status, STD_DROPPED, "flag hits the dirt");
  assert.equal(s.assets[1].towedBy, -1, "tow line cut");
});''',
'''test("phase8 component: disabling a towing truck cuts the line; disabling a carrier drops the flag", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 10, type: 3, hp: 20 },              // truck towing
      { team: 0, cellX: 11, state: ASSET_DISABLED, hp: 0 }, // wreck in tow
      { team: 1, cellX: 12 },                                // gunner
      { team: 0, cellX: 14, type: 4, hp: 20 },               // carrier w/ flag
    ],
    [], { standards: [{ team: 0, cellX: 1, status: STD_DROPPED }, { team: 1, cellX: 14 }] }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: 1 });
  s = apply(s, { type: "advance_tick" }); // tow attach + carrier pickup
  assert.equal(s.standards[1].carrierAssetId, 3);
  s = joinAndSelect(s, 1, 1, 2);
  s = apply(s, { type: "fire_order", operatorId: 1, targetAssetId: 0 });
  assert.equal(s.assets[1].towedBy, -1, "tow line cut");
  for (let i = 0; i < 15; i++) s = apply(s, { type: "advance_tick" }); // reload
  s = apply(s, { type: "fire_order", operatorId: 1, targetAssetId: 3 });
  assert.equal(s.standards[1].status, STD_DROPPED, "flag hits the dirt");
});''')
src = src.replace("""    ws.send(JSON.stringify({ type: "select_asset", assetId: 0 }));""",
"""    ws.send(JSON.stringify({ type: "select_asset", assetId: 19 })); // garage carrier""")
src = src.replace("""    const enemyStd = server.state.standards[1];
    server.state.assets[0].x = enemyStd.x;
    server.state.assets[0].y = enemyStd.y;
    appServer.pump(server.step()); // pickup
    assert.equal(server.state.standards[1].status, STD_CARRIED);
    // ...then teleport the carrier to the home zone edge; the carried
    // standard syncs in the movement pass, scoring gate checks the carrier.
    server.state.assets[0].x = cellToWorld(14);
    server.state.assets[0].y = cellToWorld(59);""",
"""    const enemyStd = server.state.standards[1];
    server.state.assets[19].x = enemyStd.x;
    server.state.assets[19].y = enemyStd.y;
    appServer.pump(server.step()); // pickup
    assert.equal(server.state.standards[1].status, STD_CARRIED);
    // ...then teleport the carrier to the home zone edge; the carried
    // standard syncs in the movement pass, scoring gate checks the carrier.
    server.state.assets[19].x = cellToWorld(14);
    server.state.assets[19].y = cellToWorld(59);""")
src = src.replace("""    [{ team: 0, cellX: 3, cellY: 1 }],""", """    [{ team: 0, cellX: 3, cellY: 1, type: 4 }],""")
open(p, "w").write(src)

# --- roster_gaps fielding pins ---
p = "test/roster_gaps.test.js"
src = open(p).read()
src = src.replace("""  assert.deepEqual(trucks(0), [11, 15, 19]);
  assert.deepEqual(trucks(1), [23, 27, 31]);
  // AI regents crew assets 8-11 / 20-23, so exactly one truck per team is
  // AI-crewed (11 and 23) and two sit in the garage for humans.""",
"""  assert.deepEqual(trucks(0), [9, 15, 17]);
  assert.deepEqual(trucks(1), [21, 27, 29]);
  const carriers = (team) => s.assets
    .filter((a) => a.team === team && a.type === 4)
    .map((a) => a.id);
  assert.deepEqual(carriers(0), [8, 19]);
  assert.deepEqual(carriers(1), [20, 31]);
  // AI regents crew assets 8-11 / 20-23: each team's AI gets a carrier (8/20)
  // and a truck (9/21); one carrier and two trucks sit in the garage.""")
src = src.replace('assert.equal(typeof stats.canTow, "boolean",\n      `${stats.name}.canTow must be explicit — new chassis must declare their tow role`);',
'''assert.equal(typeof stats.canTow, "boolean",
      `${stats.name}.canTow must be explicit — new chassis must declare their tow role`);
    assert.equal(typeof stats.canCarryStandard, "boolean",
      `${stats.name}.canCarryStandard must be explicit (9A)`);
    assert.equal(typeof stats.capacity, "number", `${stats.name}.capacity explicit (9B prep)`);''')
open(p, "w").write(src)

# --- art strip tile count ---
p = "test/art_pipeline.test.js"
src = open(p).read()
src = src.replace('assert.equal(width, 13 * 176, "one tile per procedural key + the red standard");',
                  'assert.equal(width, 15 * 176, "one tile per procedural key + the red standard");')
open(p, "w").write(src)
print("test fallout patched")
