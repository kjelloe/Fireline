import json
def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── art: builder + wreck + manifest + anchors + icon ─────────────────────────
patch("client/js/asset_factory.js",
"""function buildMine() {""",
"""function buildSentinel() {
  // 12B: a squat armored platform on four fold-legs, twin-gun casemate on
  // a ring mount — reads as "this thing intends to STAY".
  const g = new THREE.Group();
  const C = colors();
  const base = box(0.6, 0.16, 0.6, C.hullShadow); base.position.y = 0.14;
  const hull = box(0.5, 0.2, 0.5, C.hullPaint); hull.position.y = 0.32;
  const ring = cyl(0.22, 0.26, 0.08, 10, C.barrel, "wornMetal"); ring.position.y = 0.46;
  const casemate = box(0.3, 0.14, 0.34, C.hullPaint); casemate.position.y = 0.55;
  for (const side of [-1, 1]) {
    const gun = cyl(0.035, 0.04, 0.44, 6, C.barrel, "wornMetal");
    gun.rotation.x = Math.PI / 2; gun.position.set(side * 0.08, 0.55, 0.36);
    g.add(gun);
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = box(0.1, 0.1, 0.16, C.barrel, "wornMetal");
    leg.position.set(sx * 0.32, 0.1, sz * 0.32);
    leg.rotation.y = sx * sz * 0.6;
    g.add(leg);
  }
  const sensor = cyl(0.02, 0.03, 0.3, 5, C.hullShadow); sensor.position.set(-0.15, 0.75, -0.15);
  const panel = teamPanel(0.3, 0.04, 0.3); panel.position.y = 0.63;
  g.add(base, hull, ring, casemate, sensor, panel);
  return g;
}

function buildMine() {""")
patch("client/js/asset_factory.js",
"""  const base = kind === "wreck_mortar" ? buildMortar()""",
"""  const base = kind === "wreck_sentinel" ? buildSentinel()
    : kind === "wreck_mortar" ? buildMortar()""")
patch("client/js/asset_factory.js",
"""  mortar: buildMortar,                            // 11S
  wreck_mortar: () => buildWreck("wreck_mortar"), // 11S""",
"""  mortar: buildMortar,                            // 11S
  wreck_mortar: () => buildWreck("wreck_mortar"), // 11S
  sentinel: buildSentinel,                            // 12B
  wreck_sentinel: () => buildWreck("wreck_sentinel"), // 12B""")

p = "client/assets/metadata/asset_manifest.json"
m = json.load(open(p))
m["units"]["unit_sentinel"] = {
    "webglModel": "assets/models/units/unit_sentinel.glb",
    "procedural": "sentinel",
    "fallbackSprite": "assets/sprites/fallback/unit_sentinel.svg",
    "minimapIcon": "assets/icons/svg/icon_sentinel.svg",
    "triBudget": 2500,
}
m["wrecks"]["wreck_sentinel"] = {
    "webglModel": "assets/models/wrecks/wreck_sentinel.glb",
    "procedural": "wreck_sentinel",
    "fallbackSprite": "assets/sprites/fallback/wreck.svg",
    "minimapIcon": "assets/icons/svg/icon_wreck.svg",
    "triBudget": 2500,
}
json.dump(m, open(p, "w"), indent=2); open(p, "a").write("\n")
p = "client/assets/metadata/anchor_points.json"
a = json.load(open(p))
a["unit_sentinel"] = { "towRear": [0, 0.2, -0.34], "towFront": [0, 0.2, 0.34], "banner": [0, 0.8, -0.1] }
json.dump(a, open(p, "w"), indent=2); open(p, "a").write("\n")
patch("tools/build_assets.mjs",
"""  "icon_mortar.svg": svg( // 11S""",
"""  "icon_sentinel.svg": svg( // 12B: the hardpoint — a squat block on legs
    `<rect x="20" y="24" width="24" height="16" rx="2" fill="${C.hullPaint}"/>` +
    `<rect x="26" y="14" width="12" height="10" rx="2" fill="${C.hullShadow}"/>` +
    `<path d="M20 40 L10 52 M44 40 L54 52 M26 40 L22 52 M38 40 L42 52" stroke="${C.barrel}" stroke-width="4" stroke-linecap="round"/>`
  ),
  "icon_mortar.svg": svg( // 11S""")
patch("tools/build_assets.mjs",
"""  "unit_mortar.svg": ICONS["icon_mortar.svg"], // 11S""",
"""  "unit_mortar.svg": ICONS["icon_mortar.svg"], // 11S
  "unit_sentinel.svg": ICONS["icon_sentinel.svg"], // 12B""")

# ── test pins ────────────────────────────────────────────────────────────────
patch("test/art_pipeline.test.js",
"""  assert.equal(width, 22 * 176, "one tile per procedural key + the red standard (11S: +mortar +wreck_mortar)");""",
"""  assert.equal(width, 24 * 176, "one tile per procedural key + the red standard (12B: +sentinel +wreck_sentinel)");""")
# enemy-view leak pin: deployed is deliberately public.
src = open("test/component_gaps.test.js").read()
if 'assert.equal("hp" in enemy, false);' in src:
    patch("test/component_gaps.test.js",
"""    for (const enemy of view.visibleEnemies) {
      assert.equal("hp" in enemy, false);
      assert.equal("operatorId" in enemy, false);
    }""",
"""    for (const enemy of view.visibleEnemies) {
      assert.equal("hp" in enemy, false);
      assert.equal("operatorId" in enemy, false);
      // 12B: `deployed` IS public — a raised hardpoint is externally
      // obvious, like heading. Nothing else may leak.
      assert.deepEqual(Object.keys(enemy).sort(),
        ["deployed", "heading", "id", "state", "team", "type", "x", "y"]);
    }""")
patch("test/milestone11n.test.js",
"""    assert.equal(stats.heavy, type === 0, `chassis ${type} heavy flag`);""",
"""    assert.equal(stats.heavy, type === 0 || type === 7,
      `chassis ${type} heavy flag (tank + sentinel)`);""")
patch("test/milestone3a.test.js",
"""    canMine: true, canClearMines: false, // 9E: only the tank lays mines
    heavy: true, // 11N: no path bonus for the tank
    canCapture: true, siege: false, // 11R
  });""",
"""    canMine: true, canClearMines: false, // 9E: only the tank lays mines
    heavy: true, // 11N: no path bonus for the tank
    canCapture: true, siege: false, // 11R
    deployable: false, // 12B
  });""")
patch("test/milestone3a.test.js",
"""    assert.equal(teamAssets.filter((a) => a.type === 0).length, 4, "4 tanks (11R: one traded for the bike)");""",
"""    assert.equal(teamAssets.filter((a) => a.type === 0).length, team === 0 ? 3 : 4,
      "tanks (11R bike trade; 12B: Directorate trades one more for the Sentinel)");
    if (team === 0) assert.equal(teamAssets.filter((a) => a.type === 7).length, 1, "1 Sentinel (12B)");""")
patch("test/milestone9a.test.js",
"""    canMine: false, canClearMines: false,
    heavy: false, // 11N
    canCapture: true, siege: false, // 11R
  });""",
"""    canMine: false, canClearMines: false,
    heavy: false, // 11N
    canCapture: true, siege: false, // 11R
    deployable: false, // 12B
  });""")
patch("test/roster_gaps.test.js",
"""  assert.deepEqual(types, [0, 1, 2, 3, 4, 5, 6], "seven chassis fielded");""",
"""  assert.deepEqual(types, [0, 1, 2, 3, 4, 5, 6, 7],
    "eight chassis fielded (12B: Sentinel is Directorate-only until 12C adds the Skimmer)");""")

# ── strings: rejections + hardpoint UI copy (designer wording), en + no ──────
patch("client/js/strings.js",
"""    "rej.rate limited": "Slow down — command flood throttled.",""",
"""    "rej.cannot deploy here": "This chassis has no hardpoint to deploy.",
    "rej.already deployed": "Hardpoint already active.",
    "rej.not deployed": "Nothing to stow — you are mobile.",
    "rej.still transitioning": "Hardpoint legs are working — hold.",
    "rej.deployed — undeploy to move": "Sentinel cannot move while deployed.",
    "ev.hardpoint_deploying": "Deploying hardpoint…",
    "ev.hardpoint_active": "Hardpoint active.",
    "ev.hardpoint_undeploying": "Undeploying.",
    "ev.hardpoint_stowed": "Hardpoint stowed — mobile.",
    "banner.deploy": "DEPLOY HARDPOINT (H)",
    "banner.undeploy": "UNDEPLOY (H)",
    "label.deploying": "DEPLOYING {s}s",
    "label.undeploying": "UNDEPLOYING {s}s",
    "label.hardpoint": "HARDPOINT ACTIVE",
    "rej.rate limited": "Slow down — command flood throttled.",""")
patch("client/js/strings.js",
"""    "rej.rate limited": "Ro ned — kommandoflommen struptes.",""",
"""    "rej.cannot deploy here": "Denne vognen har ingen utplasserbar stilling.",
    "rej.already deployed": "Stillingen er alt aktiv.",
    "rej.not deployed": "Ingenting å pakke sammen — du er mobil.",
    "rej.still transitioning": "Beina jobber — vent.",
    "rej.deployed — undeploy to move": "Sentinel kan ikke flytte mens den er utplassert.",
    "ev.hardpoint_deploying": "Utplasserer stilling…",
    "ev.hardpoint_active": "Stillingen er aktiv.",
    "ev.hardpoint_undeploying": "Pakker sammen.",
    "ev.hardpoint_stowed": "Stillingen er pakket — mobil.",
    "banner.deploy": "UTPLASSER STILLING (H)",
    "banner.undeploy": "PAKK SAMMEN (H)",
    "label.deploying": "UTPLASSERER {s}s",
    "label.undeploying": "PAKKER {s}s",
    "label.hardpoint": "STILLING AKTIV",
    "rej.rate limited": "Ro ned — kommandoflommen struptes.",""")
patch("client/js/feedback_model.js",
"""    case "site_shelled": return `Relay ${e.siteId} under artillery fire!`;""",
"""    case "hardpoint_deploying": return t("ev.hardpoint_deploying");
    case "hardpoint_active": return t("ev.hardpoint_active");
    case "hardpoint_undeploying": return t("ev.hardpoint_undeploying");
    case "hardpoint_stowed": return t("ev.hardpoint_stowed");
    case "site_shelled": return `Relay ${e.siteId} under artillery fire!`;""")

# ── client: H key, banner action, transition/active labels ──────────────────
p = "client/js/client.js"
patch(p,
"""    if (e.key === "u" || e.key === "U") send({ type: "unboard" });""",
"""    if (e.key === "u" || e.key === "U") send({ type: "unboard" });
    // 12B: H toggles the Sentinel's hardpoint.
    if (e.key === "h" || e.key === "H") {
      const me = interpolator.latest()?.friendlyAssets?.find(
        (a) => a.operatorId === joined?.operatorId);
      if (me?.type === 7) {
        send({ type: me.deployed === 1 ? "undeploy" : "deploy_hardpoint" });
      }
    }""")
patch(p,
"""  } else {
    const wreck = adjacentTowableWreck(view);
    if (wreck) {
      text = t("banner.tow", { id: wreck.id });
      bannerAction = () => send({ type: "tow_order", wreckAssetId: wreck.id });
    }
  }""",
"""  } else {
    const wreck = adjacentTowableWreck(view);
    const me = view?.friendlyAssets?.find((a) => a.operatorId === joined.operatorId);
    if (wreck) {
      text = t("banner.tow", { id: wreck.id });
      bannerAction = () => send({ type: "tow_order", wreckAssetId: wreck.id });
    } else if (me?.type === 7 && me.deployTimer === 0) { // 12B
      text = me.deployed === 1 ? t("banner.undeploy") : t("banner.deploy");
      bannerAction = () => send({ type: me.deployed === 1 ? "undeploy" : "deploy_hardpoint" });
    }
  }""")
patch(p,
"""  // 11U: repair bays count down over the hull.""",
"""  // 12B: hardpoint states over the Sentinel.
  for (const a of view.friendlyAssets ?? []) {
    const key = `hard${a.id}`;
    let textHp = null;
    if (a.deployTimer > 0) {
      textHp = a.deployed === 1
        ? t("label.deploying", { s: Math.ceil(a.deployTimer / 10) })
        : t("label.undeploying", { s: Math.ceil(a.deployTimer / 10) });
    } else if (a.deployed === 1) {
      textHp = t("label.hardpoint");
    }
    if (textHp) {
      upsertWorldLabel(key, textHp, "#bfe3e8", a.x / CELL + 0.5, 1.7, a.y / CELL + 0.5);
    } else {
      const entry = worldLabels.get(key);
      if (entry) { scene.remove(entry.sprite); worldLabels.delete(key); }
    }
  }
  // 11U: repair bays count down over the hull.""")
patch("client/index.html",
"G direct drive (WASD, click = assisted fire)",
"G direct drive · H hardpoint")
print("12B finished")
