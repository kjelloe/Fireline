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
  const hull = box(0.66, 0.24, 0.8, C.hullPaint); hull.position.y = 0.2;
  const tracks = box(0.74, 0.14, 0.84, C.wheel); tracks.position.y = 0.08;
  const turret = box(0.4, 0.18, 0.44, C.hullShadow); turret.position.y = 0.4;
  const barrel = cyl(0.05, 0.06, 0.5, 6, C.barrel, "wornMetal");
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.42, 0.42);
  const panel = teamPanel(0.42, 0.04, 0.2); panel.position.y = 0.51;
  g.add(tracks, hull, turret, barrel, panel);
  return g;
}

function buildScout() {
  const g = new THREE.Group();
  const C = colors();
  const hull = box(0.42, 0.16, 0.6, C.hullPaint); hull.position.y = 0.22;
  const cab = box(0.34, 0.14, 0.24, C.hullShadow); cab.position.set(0, 0.36, -0.1);
  for (const [x, z] of [[-0.22, 0.2], [0.22, 0.2], [-0.22, -0.2], [0.22, -0.2]]) {
    const wheel = cyl(0.11, 0.11, 0.08, 8, C.wheel, "wornMetal");
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.11, z);
    g.add(wheel);
  }
  const panel = teamPanel(0.3, 0.04, 0.14); panel.position.set(0, 0.45, -0.1);
  g.add(hull, cab, panel);
  return g;
}

function buildArtillery() {
  const g = new THREE.Group();
  const C = colors();
  const bed = box(0.5, 0.14, 0.78, C.hullPaint); bed.position.y = 0.15;
  const tracks = box(0.58, 0.12, 0.8, C.wheel); tracks.position.y = 0.06;
  const mount = box(0.3, 0.16, 0.3, C.hullShadow); mount.position.set(0, 0.28, -0.12);
  const barrel = cyl(0.055, 0.075, 0.7, 6, C.barrel, "wornMetal");
  barrel.rotation.x = Math.PI / 2 - 0.6; barrel.position.set(0, 0.45, 0.12);
  const spade = box(0.4, 0.1, 0.12, C.hullShadow); spade.position.set(0, 0.1, -0.42);
  const panel = teamPanel(0.26, 0.04, 0.26); panel.position.set(0, 0.37, -0.12);
  g.add(tracks, bed, mount, barrel, spade, panel);
  return g;
}

function buildLogistics() {
  const g = new THREE.Group();
  const C = colors();
  const bed = box(0.46, 0.1, 0.6, C.hullPaint); bed.position.set(0, 0.24, -0.14);
  const cab = box(0.42, 0.26, 0.26, C.hullShadow); cab.position.set(0, 0.3, 0.28);
  const crane = cyl(0.03, 0.04, 0.5, 6, C.barrel, "wornMetal");
  crane.rotation.x = -0.9; crane.position.set(0.12, 0.45, -0.28);
  const hook = box(0.06, 0.08, 0.06, C.barrel, "wornMetal"); hook.position.set(0.12, 0.3, -0.52);
  for (const [x, z] of [[-0.24, 0.24], [0.24, 0.24], [-0.24, -0.1], [0.24, -0.1], [-0.24, -0.38], [0.24, -0.38]]) {
    const wheel = cyl(0.1, 0.1, 0.08, 8, C.wheel, "wornMetal");
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.1, z);
    g.add(wheel);
  }
  const panel = teamPanel(0.34, 0.04, 0.2); panel.position.set(0, 0.45, 0.28);
  g.add(bed, cab, crane, hook, panel);
  return g;
}

function buildCarrier() {
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

// Wrecks: same footprint, slumped/tilted/darkened, identifiable (spec §10).
function buildWreck(kind) {
  const base = kind === "wreck_scout" ? buildScout()
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
  standard_upright: () => buildStandard(false),
  standard_dropped: () => buildStandard(true),
  relay: buildRelay,
  command_zone: buildCommandZone,
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
