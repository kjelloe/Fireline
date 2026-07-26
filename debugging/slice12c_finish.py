import json
def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# art: skimmer builder + wreck + manifest + anchors + icon
patch("client/js/asset_factory.js",
"""function buildMine() {""",
"""function buildSkimmer() {
  // 12C: a rag-tag airboat — flat hull, big caged fan aft, outrigger
  // floats, an aerial of exposed wiring. bypass · improvise.
  const g = new THREE.Group();
  const C = colors();
  const hull = box(0.4, 0.1, 0.62, C.hullPaint); hull.position.y = 0.14;
  const bow = box(0.3, 0.08, 0.16, C.hullShadow);
  bow.position.set(0, 0.16, 0.36); bow.rotation.x = 0.25;
  for (const side of [-1, 1]) {
    const float = cyl(0.07, 0.07, 0.5, 6, C.hullShadow, "wornMetal");
    float.rotation.x = Math.PI / 2; float.position.set(side * 0.26, 0.08, 0);
    g.add(float);
  }
  const cage = cyl(0.2, 0.2, 0.08, 10, C.barrel, "wornMetal");
  cage.rotation.x = Math.PI / 2; cage.position.set(0, 0.32, -0.3);
  const fan = box(0.3, 0.3, 0.02, C.hullShadow); fan.position.set(0, 0.32, -0.3);
  const seat = box(0.16, 0.12, 0.16, C.hullShadow); seat.position.set(0, 0.24, 0.05);
  const gun = cyl(0.025, 0.03, 0.3, 6, C.barrel, "wornMetal");
  gun.rotation.x = Math.PI / 2; gun.position.set(0.1, 0.3, 0.3);
  const wire = cyl(0.008, 0.008, 0.4, 4, C.recover); wire.position.set(-0.15, 0.45, -0.1); wire.rotation.z = 0.3;
  const panel = teamPanel(0.2, 0.03, 0.16); panel.position.set(0, 0.21, -0.12);
  g.add(hull, bow, cage, fan, seat, gun, wire, panel);
  return g;
}

function buildMine() {""")
patch("client/js/asset_factory.js",
"""  const base = kind === "wreck_sentinel" ? buildSentinel()""",
"""  const base = kind === "wreck_skimmer" ? buildSkimmer()
    : kind === "wreck_sentinel" ? buildSentinel()""")
patch("client/js/asset_factory.js",
"""  sentinel: buildSentinel,                            // 12B
  wreck_sentinel: () => buildWreck("wreck_sentinel"), // 12B""",
"""  sentinel: buildSentinel,                            // 12B
  wreck_sentinel: () => buildWreck("wreck_sentinel"), // 12B
  skimmer: buildSkimmer,                            // 12C
  wreck_skimmer: () => buildWreck("wreck_skimmer"), // 12C""")

p = "client/assets/metadata/asset_manifest.json"
m = json.load(open(p))
for key, proc in [("unit_skimmer", "skimmer"), ("wreck_skimmer", "wreck_skimmer")]:
    grp = "units" if key.startswith("unit") else "wrecks"
    m[grp][key] = {
        "webglModel": f"assets/models/{grp}/{key}.glb",
        "procedural": proc,
        "fallbackSprite": f"assets/sprites/fallback/{'unit_skimmer' if grp=='units' else 'wreck'}.svg",
        "minimapIcon": f"assets/icons/svg/{'icon_skimmer' if grp=='units' else 'icon_wreck'}.svg",
        "triBudget": 2000,
    }
json.dump(m, open(p, "w"), indent=2); open(p, "a").write("\n")
p = "client/assets/metadata/anchor_points.json"
a = json.load(open(p))
a["unit_skimmer"] = { "towRear": [0, 0.15, -0.34], "towFront": [0, 0.15, 0.4], "banner": [0, 0.5, -0.1] }
json.dump(a, open(p, "w"), indent=2); open(p, "a").write("\n")
patch("tools/build_assets.mjs",
"""  "icon_sentinel.svg": svg( // 12B""",
"""  "icon_skimmer.svg": svg( // 12C: the airboat — hull wedge + fan circle
    `<path d="M12 36 L44 30 L52 36 L44 42 Z" fill="${C.hullPaint}"/>` +
    `<circle cx="16" cy="36" r="9" fill="none" stroke="${C.barrel}" stroke-width="3"/>` +
    `<path d="M16 27 V45 M8 36 H24" stroke="${C.barrel}" stroke-width="2"/>` +
    `<path d="M12 48 Q32 54 52 48" stroke="#4a7dc9" stroke-width="3" fill="none" opacity="0.7"/>`
  ),
  "icon_sentinel.svg": svg( // 12B""")
patch("tools/build_assets.mjs",
"""  "unit_sentinel.svg": ICONS["icon_sentinel.svg"], // 12B""",
"""  "unit_sentinel.svg": ICONS["icon_sentinel.svg"], // 12B
  "unit_skimmer.svg": ICONS["icon_skimmer.svg"], // 12C""")

# pins
patch("test/art_pipeline.test.js",
"""  assert.equal(width, 24 * 176, "one tile per procedural key + the red standard (12B: +sentinel +wreck_sentinel)");""",
"""  assert.equal(width, 26 * 176, "one tile per procedural key + the red standard (12C: +skimmer +wreck_skimmer)");""")
patch("test/milestone11m.test.js",
"""  assert.equal(at(63, 40), 3, "river is rough between bridges");""",
"""  assert.equal(at(63, 40), 6, "river is WATER between bridges (12C)");""")
patch("test/milestone11t.test.js",
"""  for (const w of water) {
    assert.equal(river.cells[Math.floor(w.y) * river.width + Math.floor(w.x)], 3,
      "water only over river rough");
  }""",
"""  for (const w of water) {
    assert.equal(river.cells[Math.floor(w.y) * river.width + Math.floor(w.x)], 6,
      "water props only over T_WATER (12C)");
  }""")
patch("test/milestone1f.test.js",
"""  assert.equal(speedMultiplier(5, { heavy: false }), 307);
  assert.equal(Object.keys(TERRAIN_SPEED).length, 6);""",
"""  assert.equal(speedMultiplier(5, { heavy: false }), 307);
  // 12C: water — misery to ford, a trail for the amphibious Skimmer.
  assert.equal(speedMultiplier(6), 64);
  assert.equal(speedMultiplier(6, { amphibious: true }), 307);
  assert.equal(Object.keys(TERRAIN_SPEED).length, 7);""")
patch("test/milestone3a.test.js",
"""    canCapture: true, siege: false, // 11R
    deployable: false, // 12B
  });""",
"""    canCapture: true, siege: false, // 11R
    deployable: false, // 12B
    amphibious: false, // 12C
  });""")
patch("test/milestone3a.test.js",
"""    assert.equal(teamAssets.filter((a) => a.type === 0).length, team === 0 ? 3 : 4,
      "tanks (11R bike trade; 12B: Directorate trades one more for the Sentinel)");
    if (team === 0) assert.equal(teamAssets.filter((a) => a.type === 7).length, 1, "1 Sentinel (12B)");""",
"""    assert.equal(teamAssets.filter((a) => a.type === 0).length, 3,
      "3 tanks each (11R bike trade; 12B/12C: one more for the faction unique)");
    if (team === 0) assert.equal(teamAssets.filter((a) => a.type === 7).length, 1, "1 Sentinel (12B)");
    if (team === 1) assert.equal(teamAssets.filter((a) => a.type === 8).length, 1, "1 Skimmer (12C)");""")
patch("test/milestone9a.test.js",
"""    canCapture: true, siege: false, // 11R
    deployable: false, // 12B
  });""",
"""    canCapture: true, siege: false, // 11R
    deployable: false, // 12B
    amphibious: false, // 12C
  });""")
patch("test/roster_gaps.test.js",
"""  assert.deepEqual(types, [0, 1, 2, 3, 4, 5, 6, 7],
    "eight chassis fielded (12B: Sentinel is Directorate-only until 12C adds the Skimmer)");
  for (const type of types) {
    const asset = s0.assets.find((a) => a.type === type && a.team === 0 && a.operatorId === -1);
    assert.ok(asset, `type ${type} has a free team-0 unit`);
    let s = createInitialState(42, "frontier_corridor");
    s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
    s = apply(s, { type: "select_asset", operatorId: 0, assetId: asset.id, confirm: true });
    assert.equal(s.assets[asset.id].operatorId, 0, `type ${type} selectable`);
    s = apply(s, { type: "drive", operatorId: 0, throttle: 1, turn: 0 });
    const x0 = s.assets[asset.id].x;
    s = apply(s, { type: "advance_tick" });
    assert.ok(s.assets[asset.id].x !== x0, `type ${type} drives`);
  }""",
"""  assert.deepEqual(types, [0, 1, 2, 3, 4, 5, 6, 7, 8],
    "nine chassis fielded (12B Sentinel west, 12C Skimmer east)");
  for (const type of types) {
    // Faction uniques live on one side only — test on the owning team.
    const asset = s0.assets.find((a) => a.type === type && a.operatorId === -1);
    assert.ok(asset, `type ${type} has a free unit somewhere`);
    let s = createInitialState(42, "frontier_corridor");
    s = apply(s, { type: "join_operator", operatorId: 0, team: asset.team });
    s = apply(s, { type: "select_asset", operatorId: 0, assetId: asset.id, confirm: true });
    assert.equal(s.assets[asset.id].operatorId, 0, `type ${type} selectable`);
    s = apply(s, { type: "drive", operatorId: 0, throttle: 1, turn: 0 });
    const x0 = s.assets[asset.id].x;
    s = apply(s, { type: "advance_tick" });
    assert.ok(s.assets[asset.id].x !== x0, `type ${type} drives`);
  }""")
print("12C finished")
