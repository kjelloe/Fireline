// test/art_pipeline.test.js — Art Slice A acceptance (assets/asset-spec.md).
// Manifest-driven visuals, style-token single source of truth, poly budgets,
// team identity via color AND symbol, no hardcoded paths in the renderer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  setStyleTokens, buildProcedural, proceduralKeys, applyTeamColor, countTriangles,
} from "../client/js/asset_factory.js";
import {
  visualKeyFor, standardVisualKey, resolveVisual, manifestEntry, teamToken, chassisName,
} from "../client/js/asset_resolver.js";
import { UNIT_STATS } from "../engine/units.js";

const root = new URL("../", import.meta.url);
const tokens = JSON.parse(readFileSync(new URL("client/assets/metadata/style_tokens.json", root)));
const manifest = JSON.parse(readFileSync(new URL("client/assets/metadata/asset_manifest.json", root)));
const anchors = JSON.parse(readFileSync(new URL("client/assets/metadata/anchor_points.json", root)));
setStyleTokens(tokens);

test("art: every engine chassis has unit + wreck manifest entries and anchors", () => {
  for (const type of Object.keys(UNIT_STATS)) {
    const chassis = chassisName(Number(type));
    const unitKey = `unit_${chassis}`;
    const wreckKey = `wreck_${chassis}`;
    assert.ok(manifest.units[unitKey], `manifest missing ${unitKey}`);
    assert.ok(manifest.wrecks[wreckKey], `manifest missing ${wreckKey}`);
    const anchor = anchors[unitKey];
    assert.ok(anchor, `anchors missing ${unitKey}`);
    for (const name of ["towRear", "towFront", "banner"]) {
      assert.equal(anchor[name].length, 3, `${unitKey}.${name} is an [x,y,z] offset`);
    }
  }
});

test("art: team identity carries BOTH color and symbol (spec §7 colorblind rule)", () => {
  assert.ok(tokens.teams.length >= 2);
  for (const team of tokens.teams) {
    assert.match(team.color, /^#[0-9a-f]{6}$/i);
    assert.ok(["square", "triangle", "circle", "diamond"].includes(team.symbol));
    const iconPath = new URL(`client/assets/icons/svg/team_${team.symbol}.svg`, root);
    assert.ok(existsSync(iconPath), `symbol icon for team ${team.name}`);
  }
  assert.equal(teamToken(tokens, 1).name, "red");
  assert.equal(teamToken(tokens, 99).name, "green", "unknown team falls back safely");
});

test("art: every procedural stand-in respects its manifest poly budget", () => {
  for (const group of [manifest.units, manifest.wrecks, manifest.objectives]) {
    for (const [key, entry] of Object.entries(group)) {
      const mesh = buildProcedural(entry.procedural);
      assert.ok(mesh, `${key}: procedural builder "${entry.procedural}" exists`);
      const tris = countTriangles(mesh);
      assert.ok(tris > 0 && tris <= entry.triBudget,
        `${key}: ${tris} tris within budget ${entry.triBudget}`);
    }
  }
  assert.ok(proceduralKeys().length >= 10);
});

test("art: team panel slot tints without touching the painted body", () => {
  const tank = buildProcedural("tank");
  const bodies = [];
  let panel = null;
  tank.traverse((n) => {
    if (!n.isMesh) return;
    if (n.name === "team_panel") panel = n;
    else bodies.push(n.material.color.getHexString());
  });
  assert.ok(panel, "tank exposes a team_panel slot");
  applyTeamColor(tank, "#c7443e");
  assert.equal(panel.material.color.getHexString(), "c7443e");
  const bodiesAfter = [];
  tank.traverse((n) => {
    if (n.isMesh && n.name !== "team_panel") bodiesAfter.push(n.material.color.getHexString());
  });
  assert.deepEqual(bodiesAfter, bodies, "painted body untouched by tinting");
});

test("art: wrecks share the footprint but read as wrecks", () => {
  const unit = buildProcedural("tank");
  const wreck = buildProcedural("wreck_tank");
  assert.ok(wreck.scale.y < 1, "slumped");
  assert.notEqual(wreck.rotation.z, 0, "tilted");
  let fadedPanel = false;
  wreck.traverse((n) => { if (n.name === "team_panel_faded") fadedPanel = true; });
  assert.ok(fadedPanel, "wreck team panel is faded, not tintable");
  assert.equal(countTriangles(wreck), countTriangles(unit), "same silhouette source");
});

test("art: state → visual key mapping is exact", () => {
  assert.equal(visualKeyFor({ type: 0, state: 0 }), "unit_tank");
  assert.equal(visualKeyFor({ type: 1, state: 1 }), "unit_scout");
  assert.equal(visualKeyFor({ type: 2, state: 2 }), "wreck_artillery");
  assert.equal(visualKeyFor({ type: 0, state: 3 }), "wreck_tank");
  assert.equal(standardVisualKey({ status: 0 }), "standard_upright");
  assert.equal(standardVisualKey({ status: 1 }), "standard_upright");
  assert.equal(standardVisualKey({ status: 2 }), "standard_dropped");
});

test("art: resolution order is GLB → procedural → sprite", () => {
  const key = "unit_tank";
  const withModel = resolveVisual(manifest, key, { available: () => true });
  assert.equal(withModel.kind, "model");
  assert.match(withModel.url, /unit_vehicle_tank\.glb$/);

  const noModel = resolveVisual(manifest, key, { available: () => false });
  assert.equal(noModel.kind, "procedural");
  assert.equal(noModel.key, "tank");

  const spriteOnly = resolveVisual(
    { units: { x: { fallbackSprite: "assets/sprites/fallback/unit_tank.svg" } } }, "x");
  assert.equal(spriteOnly.kind, "sprite");
  assert.equal(resolveVisual(manifest, "nope").kind, "missing");
  assert.ok(manifestEntry(manifest, "standard_dropped"), "objectives resolvable too");
});

test("art: build tool is idempotent and its outputs exist and are SVG", () => {
  execFileSync("node", [new URL("tools/build_assets.mjs", root).pathname]);
  for (const group of [manifest.units, manifest.wrecks, manifest.objectives]) {
    for (const entry of Object.values(group)) {
      for (const ref of [entry.fallbackSprite, entry.minimapIcon]) {
        const file = new URL(`client/${ref}`, root);
        assert.ok(existsSync(file), `${ref} exists`);
        assert.match(readFileSync(file, "utf8"), /^<svg /, `${ref} is SVG`);
      }
    }
  }
  for (const ref of Object.values(manifest.ui)) {
    assert.ok(existsSync(new URL(`client/${ref}`, root)), `${ref} exists`);
  }
});

test("art: the renderer holds no hardcoded model paths or ad-hoc unit shapes", () => {
  const clientSrc = readFileSync(new URL("client/js/client.js", root), "utf8");
  assert.equal(clientSrc.includes(".glb"), false, "GLB paths live in the manifest only");
  assert.equal(/BoxGeometry\(0\.8, 0\.5, 0\.8\)/.test(clientSrc), false,
    "legacy inline unit box removed");
  assert.match(clientSrc, /resolveVisual\(/, "renderer resolves through the manifest");
});

test("art: the demo asset strip renders deterministically as a valid PNG", () => {
  // Design ruling Q9b: a committed strip PNG for human assessment.
  const tool = new URL("tools/render_asset_strip.mjs", root).pathname;
  execFileSync("node", [tool]);
  const stripPath = new URL("client/assets/preview/asset_strip.png", root);
  const first = readFileSync(stripPath);
  assert.deepEqual([...first.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "PNG signature");
  const width = first.readUInt32BE(16);
  const height = first.readUInt32BE(20);
  assert.equal(width, 16 * 176, "one tile per procedural key + the red standard");
  assert.equal(height, 176 + 18);
  execFileSync("node", [tool]);
  const second = readFileSync(stripPath);
  assert.deepEqual(second, first, "byte-identical across runs");
});

test("art: assets are served to the browser over HTTP", async () => {
  const { createAppServer } = await import("../server/index.js");
  const appServer = createAppServer({ mapSeed: 1, enableAi: false });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    for (const url of [
      "/assets/metadata/asset_manifest.json",
      "/assets/metadata/style_tokens.json",
      "/assets/icons/svg/icon_standard.svg",
      "/assets/sprites/fallback/unit_tank.svg",
    ]) {
      const res = await fetch(`http://localhost:${addr.port}${url}`);
      assert.equal(res.status, 200, url);
    }
  } finally {
    await appServer.stop();
  }
});
