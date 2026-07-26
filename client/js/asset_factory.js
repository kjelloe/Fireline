// client/js/asset_factory.js — procedural Painted Low-Poly Hybrid stand-ins
// (Art Slice A, assets/asset-spec.md §20). Chunky silhouettes, matte painted
// materials from style tokens, tintable team-panel slot. Each builder returns
// a THREE.Group; the renderer swaps these for GLBs later purely via the
// manifest. Node-testable: triangle counts are asserted against triBudget.

import * as THREE from "three";

let TOKENS = null;

export function setStyleTokens(tokens) {
  TOKENS = tokens;
}

function colors() {
  return TOKENS?.colors ?? {};
}

function mat(colorHex, tokenName = "paintedMatte") {
  const m = TOKENS?.materials?.[tokenName] ?? { roughness: 0.85, metalness: 0 };
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex), roughness: m.roughness, metalness: m.metalness,
  });
}

function box(w, h, d, colorHex, token) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(colorHex, token));
}

function cyl(rTop, rBottom, h, seg, colorHex, token) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat(colorHex, token));
}

// Team panel slot: one mesh per unit named "team_panel" so the renderer can
// tint it without touching the painted body (spec §7).
function teamPanel(w, h, d) {
  const panel = box(w, h, d, "#ffffff", "teamPanel");
  panel.name = "team_panel";
  return panel;
}

function buildTank() {
  const g = new THREE.Group();
  const C = colors();
  // Twin track assemblies with visible road wheels — the low-poly promise
  // is chunk, not blur.
  for (const side of [-1, 1]) {
    const track = box(0.16, 0.16, 0.88, C.wheel, "wornMetal");
    track.position.set(side * 0.3, 0.1, 0);
    g.add(track);
    for (const z of [-0.28, 0, 0.28]) {
      const wheel = cyl(0.09, 0.09, 0.05, 8, C.hullShadow, "wornMetal");
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 0.34, 0.1, z);
      g.add(wheel);
    }
  }
  const lower = box(0.52, 0.14, 0.86, C.hullShadow); lower.position.y = 0.18;
  const glacis = box(0.5, 0.18, 0.62, C.hullPaint);
  glacis.position.set(0, 0.3, 0.04); glacis.rotation.x = -0.08;
  const turret = box(0.38, 0.14, 0.42, C.hullPaint); turret.position.set(0, 0.44, -0.04);
  const mantlet = box(0.2, 0.12, 0.1, C.hullShadow); mantlet.position.set(0, 0.44, 0.2);
  const barrel = cyl(0.045, 0.05, 0.56, 8, C.barrel, "wornMetal");
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.44, 0.5);
  const brake = cyl(0.07, 0.07, 0.08, 8, C.barrel, "wornMetal");
  brake.rotation.x = Math.PI / 2; brake.position.set(0, 0.44, 0.76);
  const cupola = cyl(0.09, 0.11, 0.08, 8, C.hullShadow); cupola.position.set(-0.1, 0.55, -0.12);
  const antenna = cyl(0.008, 0.012, 0.42, 4, C.barrel, "wornMetal");
  antenna.position.set(0.15, 0.72, -0.2);
  for (const side of [-1, 1]) {
    const exhaust = cyl(0.035, 0.035, 0.14, 6, C.barrel, "wornMetal");
    exhaust.position.set(side * 0.18, 0.34, -0.44); exhaust.rotation.x = 0.5;
    g.add(exhaust);
  }
  const panel = teamPanel(0.3, 0.04, 0.34); panel.position.set(0, 0.52, -0.04);
  g.add(lower, glacis, turret, mantlet, barrel, brake, cupola, antenna, panel);
  return g;
}

function buildScout() {
  // Open recon buggy: hood, roll cage, whip antenna, spare on the tail.
  const g = new THREE.Group();
  const C = colors();
  const pan = box(0.4, 0.1, 0.62, C.hullShadow); pan.position.y = 0.18;
  const hood = box(0.36, 0.1, 0.24, C.hullPaint);
  hood.position.set(0, 0.26, 0.2); hood.rotation.x = 0.12;
  const dash = box(0.36, 0.12, 0.16, C.hullPaint); dash.position.set(0, 0.28, 0);
  for (const [x, z] of [[-0.22, 0.22], [0.22, 0.22], [-0.22, -0.22], [0.22, -0.22]]) {
    const wheel = cyl(0.12, 0.12, 0.1, 8, C.wheel, "wornMetal");
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.12, z);
    g.add(wheel);
  }
  for (const [x, z] of [[-0.16, 0.02], [0.16, 0.02], [-0.16, -0.3], [0.16, -0.3]]) {
    const post = cyl(0.02, 0.02, 0.24, 5, C.barrel, "wornMetal");
    post.position.set(x, 0.4, z);
    g.add(post);
  }
  const cageTop = box(0.36, 0.03, 0.36, C.barrel, "wornMetal");
  cageTop.position.set(0, 0.52, -0.14);
  const spare = cyl(0.11, 0.11, 0.07, 8, C.wheel, "wornMetal");
  spare.position.set(0, 0.3, -0.4); spare.rotation.x = Math.PI / 2;
  const whip = cyl(0.006, 0.01, 0.5, 4, C.barrel, "wornMetal");
  whip.position.set(-0.18, 0.6, -0.28); whip.rotation.z = 0.15;
  const panel = teamPanel(0.3, 0.03, 0.2); panel.position.set(0, 0.55, -0.14);
  g.add(pan, hood, dash, cageTop, spare, whip, panel);
  return g;
}

function buildArtillery() {
  // Siege piece: split trail legs, long two-stage tube, ammo on the deck.
  const g = new THREE.Group();
  const C = colors();
  const bed = box(0.48, 0.12, 0.6, C.hullPaint); bed.position.y = 0.16;
  const tracks = box(0.56, 0.12, 0.62, C.wheel, "wornMetal"); tracks.position.y = 0.07;
  for (const side of [-1, 1]) {
    const trail = box(0.08, 0.08, 0.44, C.hullShadow);
    trail.position.set(side * 0.14, 0.1, -0.5);
    trail.rotation.y = side * 0.3;
    const spade = box(0.12, 0.12, 0.06, C.barrel, "wornMetal");
    spade.position.set(side * 0.2, 0.08, -0.68);
    g.add(trail, spade);
  }
  const cradle = box(0.26, 0.18, 0.3, C.hullShadow); cradle.position.set(0, 0.3, -0.08);
  const quadrant = cyl(0.14, 0.14, 0.05, 8, C.hullPaint);
  quadrant.rotation.z = Math.PI / 2; quadrant.position.set(0.14, 0.34, -0.08);
  const sleeve = cyl(0.08, 0.09, 0.3, 8, C.barrel, "wornMetal");
  sleeve.rotation.x = Math.PI / 2 - 0.6; sleeve.position.set(0, 0.42, 0.06);
  const tube = cyl(0.05, 0.065, 0.62, 8, C.barrel, "wornMetal");
  tube.rotation.x = Math.PI / 2 - 0.6; tube.position.set(0, 0.56, 0.3);
  const brake = cyl(0.08, 0.08, 0.07, 8, C.barrel, "wornMetal");
  brake.rotation.x = Math.PI / 2 - 0.6; brake.position.set(0, 0.68, 0.5);
  for (const [x, z] of [[-0.16, -0.3], [0.16, -0.34]]) {
    const crate = box(0.12, 0.1, 0.16, C.crate ?? C.hullPaint);
    crate.position.set(x, 0.27, z);
    g.add(crate);
  }
  const panel = teamPanel(0.24, 0.04, 0.2); panel.position.set(0, 0.41, -0.24);
  g.add(tracks, bed, cradle, quadrant, sleeve, tube, brake, panel);
  return g;
}

function buildLogistics() {
  // The rescue mule: crew cab, laden bed, two-stage crane with a cable.
  const g = new THREE.Group();
  const C = colors();
  const chassisRail = box(0.4, 0.06, 0.9, C.hullShadow); chassisRail.position.y = 0.14;
  const bed = box(0.46, 0.08, 0.58, C.hullPaint); bed.position.set(0, 0.22, -0.16);
  const cab = box(0.42, 0.24, 0.24, C.hullPaint); cab.position.set(0, 0.32, 0.3);
  const windshield = box(0.36, 0.1, 0.03, C.hullShadow); windshield.position.set(0, 0.4, 0.42);
  const bumper = box(0.44, 0.08, 0.05, C.barrel, "wornMetal"); bumper.position.set(0, 0.16, 0.46);
  for (const side of [-1, 1]) {
    const mirror = box(0.03, 0.08, 0.03, C.hullShadow);
    mirror.position.set(side * 0.24, 0.42, 0.4);
    g.add(mirror);
  }
  for (const [x, z] of [[-0.16, -0.06], [0.06, -0.2]]) {
    const crate = box(0.16, 0.14, 0.18, C.crate ?? C.hullShadow);
    crate.position.set(x, 0.33, z);
    g.add(crate);
  }
  const craneBase = box(0.1, 0.14, 0.1, C.hullShadow); craneBase.position.set(0.14, 0.3, -0.36);
  const boom = cyl(0.03, 0.04, 0.44, 6, C.barrel, "wornMetal");
  boom.rotation.x = -0.9; boom.position.set(0.14, 0.5, -0.42);
  const jib = cyl(0.025, 0.03, 0.24, 6, C.barrel, "wornMetal");
  jib.rotation.x = -1.5; jib.position.set(0.14, 0.62, -0.62);
  const cable = cyl(0.008, 0.008, 0.22, 4, C.hullShadow);
  cable.position.set(0.14, 0.5, -0.7);
  const hook = box(0.05, 0.07, 0.05, C.barrel, "wornMetal"); hook.position.set(0.14, 0.36, -0.7);
  for (const [x, z] of [[-0.24, 0.26], [0.24, 0.26], [-0.24, -0.08], [0.24, -0.08], [-0.24, -0.38], [0.24, -0.38]]) {
    const wheel = cyl(0.1, 0.1, 0.09, 8, C.wheel, "wornMetal");
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.1, z);
    g.add(wheel);
  }
  const panel = teamPanel(0.34, 0.04, 0.16); panel.position.set(0, 0.46, 0.3);
  g.add(chassisRail, bed, cab, windshield, bumper, craneBase, boom, jib, cable, hook, panel);
  return g;
}

function buildCarrier() {
  // The Command Carrier reads as RESCUE at a glance: white cross beams on
  // the roof module, twin beacons, side skirts, rear ramp down-ready.
  const g = new THREE.Group();
  const C = colors();
  const tracks = box(0.62, 0.14, 0.9, C.wheel, "wornMetal"); tracks.position.y = 0.08;
  for (const side of [-1, 1]) {
    const skirt = box(0.05, 0.12, 0.8, C.hullShadow);
    skirt.position.set(side * 0.31, 0.22, 0);
    g.add(skirt);
  }
  const hull = box(0.54, 0.28, 0.84, C.hullPaint); hull.position.y = 0.3;
  const prow = box(0.5, 0.18, 0.2, C.hullPaint);
  prow.position.set(0, 0.3, 0.5); prow.rotation.x = 0.35;
  const module = box(0.44, 0.16, 0.5, C.hullShadow); module.position.set(0, 0.52, -0.08);
  const crossA = box(0.3, 0.04, 0.09, "#f2f0e8"); crossA.position.set(0, 0.61, -0.08);
  const crossB = box(0.09, 0.04, 0.3, "#f2f0e8"); crossB.position.set(0, 0.61, -0.08);
  const cab = box(0.46, 0.14, 0.18, C.hullPaint); cab.position.set(0, 0.5, 0.28);
  const visor = box(0.4, 0.05, 0.03, C.hullShadow); visor.position.set(0, 0.54, 0.38);
  const ramp = box(0.4, 0.05, 0.24, C.hullShadow);
  ramp.position.set(0, 0.14, -0.52); ramp.rotation.x = 0.5;
  for (const side of [-1, 1]) {
    const beacon = cyl(0.04, 0.04, 0.1, 6, C.recover, "wornMetal");
    beacon.position.set(side * 0.18, 0.66, 0.24);
    g.add(beacon);
  }
  for (const side of [-1, 1]) {
    const hatch = cyl(0.07, 0.08, 0.04, 8, C.hullPaint);
    hatch.position.set(side * 0.14, 0.61, -0.3);
    g.add(hatch);
  }
  const panel = teamPanel(0.44, 0.04, 0.14); panel.position.set(0, 0.61, 0.1);
  g.add(tracks, hull, prow, module, crossA, crossB, cab, visor, ramp, panel);
  return g;
}

// Wrecks: same footprint, slumped/tilted/darkened, identifiable (spec §10).
function buildWreck(kind) {
  const base = kind === "wreck_mortar" ? buildMortar()
    : kind === "wreck_bike" ? buildBike()
    : kind === "wreck_scout" ? buildScout()
    : kind === "wreck_artillery" ? buildArtillery()
    : kind === "wreck_logistics" ? buildLogistics()
    : kind === "wreck_carrier" ? buildCarrier() : buildTank();
  const C = colors();
  base.traverse((node) => {
    if (node.isMesh) {
      node.material = mat(C.wreckBody, "wreck");
      if (node.name === "team_panel") node.name = "team_panel_faded";
    }
  });
  base.scale.y = 0.62;
  base.rotation.z = 0.14;
  base.rotation.y = 0.35;
  return base;
}

function buildOperatorDown() {
  const g = new THREE.Group();
  const C = colors();
  const body = box(0.14, 0.09, 0.34, C.hullShadow); body.position.set(0, 0.06, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), mat(C.hullPaint));
  head.position.set(0, 0.08, 0.22);
  const panel = teamPanel(0.1, 0.03, 0.1); panel.position.set(0, 0.12, -0.05);
  g.add(body, head, panel);
  return g;
}

function buildStandard(dropped) {
  const g = new THREE.Group();
  const C = colors();
  const base = cyl(0.22, 0.26, 0.08, 6, C.hullShadow); base.position.y = 0.04;
  const pole = cyl(0.035, 0.045, 1.5, 6, C.standardPole); pole.position.y = 0.8;
  const banner = teamPanel(0.04, 0.34, 0.5); banner.position.set(0, 1.25, 0.27);
  g.add(base, pole, banner);
  if (dropped) {
    g.rotation.z = Math.PI / 2 - 0.35; // lying, tip propped on the base
    g.position.y = 0.05;
  }
  return g;
}

function buildRelay() {
  const g = new THREE.Group();
  const C = colors();
  const mast = cyl(0.09, 0.14, 1.3, 6, C.hullShadow, "wornMetal"); mast.position.y = 0.65;
  const dish = cyl(0.3, 0.3, 0.06, 8, C.hullPaint); dish.position.y = 1.35;
  const panel = teamPanel(0.26, 0.18, 0.05); panel.position.set(0, 0.5, 0.12);
  g.add(mast, dish, panel);
  return g;
}

function buildCommandZone() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.0, 24),
    mat(colors().recover, "paintedMatte")
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(ring);
  return g;
}

function buildBike() {
  // 11R: two wheels, a frame, a hunched rider silhouette — pure hurry.
  const g = new THREE.Group();
  const C = colors();
  for (const z of [0.2, -0.18]) {
    const wheel = cyl(0.13, 0.13, 0.05, 10, C.wheel, "wornMetal");
    wheel.rotation.x = Math.PI / 2; wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0, 0.13, z);
    g.add(wheel);
  }
  const frame = box(0.08, 0.07, 0.4, C.hullPaint); frame.position.y = 0.2;
  const tank = box(0.1, 0.08, 0.14, C.hullShadow); tank.position.set(0, 0.27, 0.06);
  const bars = box(0.22, 0.03, 0.03, C.barrel, "wornMetal"); bars.position.set(0, 0.32, 0.17);
  const rider = box(0.1, 0.14, 0.16, C.hullShadow);
  rider.position.set(0, 0.33, -0.08); rider.rotation.x = 0.35;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), mat(C.hullPaint));
  helmet.position.set(0, 0.42, 0.02);
  const pannier = box(0.16, 0.08, 0.1, C.crate ?? C.hullPaint); pannier.position.set(0, 0.22, -0.24);
  const panel = teamPanel(0.12, 0.03, 0.1); panel.position.set(0, 0.27, -0.24);
  g.add(frame, tank, bars, rider, helmet, pannier, panel);
  return g;
}

function buildMortar() {
  // 11S: a light tracked chassis with a stubby high-angle tube and a
  // baseplate — reads as "runs with the column, lobs over it".
  const g = new THREE.Group();
  const C = colors();
  const tracks = box(0.52, 0.12, 0.6, C.wheel, "wornMetal"); tracks.position.y = 0.07;
  const hull = box(0.44, 0.14, 0.56, C.hullPaint); hull.position.y = 0.18;
  const bay = box(0.34, 0.1, 0.3, C.hullShadow); bay.position.set(0, 0.28, -0.06);
  const baseplate = cyl(0.14, 0.17, 0.05, 8, C.barrel, "wornMetal");
  baseplate.position.set(0, 0.3, -0.06);
  const tube = cyl(0.06, 0.075, 0.4, 8, C.barrel, "wornMetal");
  tube.rotation.x = Math.PI / 2 - 1.15; tube.position.set(0, 0.48, 0.04);
  const bipod = cyl(0.015, 0.02, 0.24, 5, C.hullShadow);
  bipod.rotation.x = -0.7; bipod.position.set(0.08, 0.4, 0.14);
  for (const [x, z] of [[-0.14, -0.2], [0.14, -0.2]]) {
    const crate = box(0.1, 0.08, 0.12, C.crate ?? C.hullPaint);
    crate.position.set(x, 0.36, z);
    g.add(crate);
  }
  const panel = teamPanel(0.24, 0.04, 0.12); panel.position.set(0, 0.28, 0.22);
  g.add(tracks, hull, bay, baseplate, tube, bipod, panel);
  return g;
}

function buildMine() {
  const g = new THREE.Group();
  const C = colors();
  const body = cyl(0.16, 0.2, 0.07, 10, C.hullShadow, "wornMetal"); body.position.y = 0.04;
  const button = cyl(0.05, 0.06, 0.04, 8, C.barrel, "wornMetal"); button.position.y = 0.09;
  for (let i = 0; i < 4; i++) {
    const prong = cyl(0.01, 0.015, 0.1, 4, C.barrel, "wornMetal");
    const a = (i / 4) * Math.PI * 2;
    prong.position.set(Math.cos(a) * 0.13, 0.1, Math.sin(a) * 0.13);
    g.add(prong);
  }
  const panel = teamPanel(0.08, 0.02, 0.08); panel.position.y = 0.115;
  g.add(body, button, panel);
  return g;
}

function buildDrone() {
  const g = new THREE.Group();
  const C = colors();
  const pod = box(0.16, 0.09, 0.22, C.hullShadow); pod.position.y = 0;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), mat(C.barrel, "wornMetal"));
  eye.position.set(0, -0.04, 0.12);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const arm = box(0.16, 0.02, 0.03, C.barrel, "wornMetal");
    arm.position.set(sx * 0.14, 0.04, sz * 0.12);
    arm.rotation.y = sx * sz * 0.5;
    const rotor = cyl(0.09, 0.09, 0.015, 8, C.hullPaint);
    rotor.position.set(sx * 0.22, 0.07, sz * 0.19);
    g.add(arm, rotor);
  }
  const panel = teamPanel(0.1, 0.02, 0.14); panel.position.y = 0.06;
  g.add(pod, eye, panel);
  return g;
}

const BUILDERS = {
  tank: buildTank,
  scout: buildScout,
  artillery: buildArtillery,
  logistics: buildLogistics,
  carrier: buildCarrier,
  wreck_tank: () => buildWreck("wreck_tank"),
  wreck_scout: () => buildWreck("wreck_scout"),
  wreck_artillery: () => buildWreck("wreck_artillery"),
  wreck_logistics: () => buildWreck("wreck_logistics"),
  wreck_carrier: () => buildWreck("wreck_carrier"),
  bike: buildBike,                              // 11R
  wreck_bike: () => buildWreck("wreck_bike"),   // 11R
  mortar: buildMortar,                            // 11S
  wreck_mortar: () => buildWreck("wreck_mortar"), // 11S
  operator_down: buildOperatorDown,
  standard_upright: () => buildStandard(false),
  standard_dropped: () => buildStandard(true),
  relay: buildRelay,
  command_zone: buildCommandZone,
  mine: buildMine,   // 11Q
  drone: buildDrone, // 11Q
};

export function proceduralKeys() {
  return Object.keys(BUILDERS);
}

export function buildProcedural(key) {
  const builder = BUILDERS[key];
  if (!builder) return null;
  return builder();
}

// Tint the team-panel slot without touching the painted body.
export function applyTeamColor(group, colorHex) {
  group.traverse((node) => {
    if (node.isMesh && node.name === "team_panel") node.material.color.set(colorHex);
  });
}

export function countTriangles(group) {
  let triangles = 0;
  group.traverse((node) => {
    if (!node.isMesh) return;
    const geo = node.geometry;
    triangles += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
  });
  return Math.round(triangles);
}
