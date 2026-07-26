import json

# factory: carrier builder + wreck + BUILDERS
p = "client/js/asset_factory.js"
src = open(p).read()
src = src.replace("// Wrecks: same footprint, slumped/tilted/darkened, identifiable (spec §10).",
"""function buildCarrier() {
  const g = new THREE.Group();
  const C = colors();
  const hull = box(0.56, 0.34, 0.86, C.hullPaint); hull.position.y = 0.3;
  const cab = box(0.5, 0.16, 0.2, C.hullShadow); cab.position.set(0, 0.56, 0.3);
  const ramp = box(0.4, 0.06, 0.22, C.hullShadow); ramp.position.set(0, 0.14, -0.5); ramp.rotation.x = 0.5;
  const tracks = box(0.64, 0.14, 0.9, C.wheel); tracks.position.y = 0.08;
  const beacon = cyl(0.05, 0.05, 0.12, 6, C.recover, "wornMetal"); beacon.position.set(0, 0.68, 0.1);
  const panel = teamPanel(0.4, 0.05, 0.5); panel.position.set(0, 0.5, -0.05);
  g.add(tracks, hull, cab, ramp, beacon, panel);
  return g;
}

// Wrecks: same footprint, slumped/tilted/darkened, identifiable (spec §10).""")
src = src.replace('''  const base = kind === "wreck_scout" ? buildScout()
    : kind === "wreck_artillery" ? buildArtillery()
    : kind === "wreck_logistics" ? buildLogistics() : buildTank();''',
'''  const base = kind === "wreck_scout" ? buildScout()
    : kind === "wreck_artillery" ? buildArtillery()
    : kind === "wreck_logistics" ? buildLogistics()
    : kind === "wreck_carrier" ? buildCarrier() : buildTank();''')
src = src.replace("""  logistics: buildLogistics,
  wreck_tank: () => buildWreck("wreck_tank"),""",
"""  logistics: buildLogistics,
  carrier: buildCarrier,
  wreck_tank: () => buildWreck("wreck_tank"),""")
src = src.replace("""  wreck_logistics: () => buildWreck("wreck_logistics"),
  standard_upright:""",
"""  wreck_logistics: () => buildWreck("wreck_logistics"),
  wreck_carrier: () => buildWreck("wreck_carrier"),
  standard_upright:""")
open(p, "w").write(src)

# manifest
p = "client/assets/metadata/asset_manifest.json"
m = json.load(open(p))
m["units"]["unit_carrier"] = {
  "webglModel": "assets/models/units/unit_vehicle_carrier.glb",
  "procedural": "carrier",
  "fallbackSprite": "assets/sprites/fallback/unit_carrier.svg",
  "minimapIcon": "assets/icons/svg/icon_carrier.svg",
  "triBudget": 3000,
}
m["wrecks"]["wreck_carrier"] = {
  "webglModel": "assets/models/wrecks/wreck_vehicle_carrier.glb",
  "procedural": "wreck_carrier",
  "fallbackSprite": "assets/sprites/fallback/wreck.svg",
  "minimapIcon": "assets/icons/svg/icon_wreck.svg",
  "triBudget": 2000,
}
del m["reserved"]["unit_infantry_carrier"]
m["reserved"]["note"] = "infantry_carrier role fielded as unit_carrier (Command Carrier, 9A); vehicle_recovery fielded as unit_logistics"
json.dump(m, open(p, "w"), indent=2); open(p, "a").write("\n")

# anchors
p = "client/assets/metadata/anchor_points.json"
a = json.load(open(p))
a["unit_carrier"] = {"towRear": [0, 0.22, -0.55], "towFront": [0, 0.22, 0.55], "banner": [0, 0.85, -0.1]}
json.dump(a, open(p, "w"), indent=2); open(p, "a").write("\n")

# icon + sprite in build tool
p = "tools/build_assets.mjs"
src = open(p).read()
src = src.replace('''  "icon_wreck.svg": svg(''',
'''  "icon_carrier.svg": svg(
    `<rect x="10" y="22" width="36" height="26" rx="4" fill="${C.hullPaint}" stroke="${C.hullShadow}" stroke-width="3"/>` +
    `<rect x="46" y="28" width="10" height="20" rx="2" fill="${C.hullShadow}"/>` +
    `<circle cx="28" cy="16" r="4" fill="${C.recover}"/>`
  ),
  "icon_wreck.svg": svg(''')
src = src.replace('''  "wreck.svg": ICONS["icon_wreck.svg"],''',
'''  "unit_carrier.svg": ICONS["icon_carrier.svg"],
  "wreck.svg": ICONS["icon_wreck.svg"],''')
open(p, "w").write(src)
print("9A art edits done")
