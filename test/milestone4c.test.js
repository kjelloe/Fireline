// test/milestone4c.test.js — Milestone 4C: event → VFX mapping and lifetimes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mapEventsToVfx, vfxAge, pruneVfx, VFX_TTL_MS } from "../client/js/vfx_cues.js";

const view = {
  friendlyAssets: [{ id: 0, x: 10 * 256, y: 5 * 256 }],
  visibleEnemies: [{ id: 4, x: 12 * 256, y: 5 * 256 }],
  sites: [{ id: 1, cellX: 30, cellY: 40 }],
};

test("4C fire spawns muzzle flash at gun and impact at target", () => {
  const fx = mapEventsToVfx([
    { type: "fire_resolved", attackerId: 0, targetId: 4, hpDelta: 20, targetHp: 60 },
  ], view, 1000);
  assert.deepEqual(fx.map((f) => f.kind), ["muzzle_flash", "explosion"]);
  assert.deepEqual(fx[0].at, { x: 10.5, y: 5.5 });
  assert.deepEqual(fx[1].at, { x: 12.5, y: 5.5 });
});

test("4C disablement and capture spawn their effects", () => {
  const fx = mapEventsToVfx([
    { type: "asset_disabled", assetId: 4 },
    { type: "site_captured", siteId: 1, team: 0 },
  ], view, 0);
  assert.deepEqual(fx.map((f) => f.kind), ["explosion", "capture_pulse"]);
  assert.equal(fx[0].ttlMs, VFX_TTL_MS.explosion);
});

test("4C ages and pruning are exact", () => {
  const fx = mapEventsToVfx([{ type: "asset_disabled", assetId: 4 }], view, 1000);
  assert.equal(vfxAge(fx[0], 1000), 0);
  assert.equal(vfxAge(fx[0], 1000 + VFX_TTL_MS.explosion / 2), 0.5);
  assert.equal(vfxAge(fx[0], 5000), 1);
  assert.equal(pruneVfx(fx, 1000).length, 1);
  assert.equal(pruneVfx(fx, 1000 + VFX_TTL_MS.explosion).length, 0);
});
