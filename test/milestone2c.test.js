// test/milestone2c.test.js — Milestone 2C: snapshot interpolator.
// Presentation math only — verifies smoothing, buffering, and the fog
// authority rule (interpolation never resurrects fogged-out entities).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInterpolator } from "../client/js/interpolator.js";

function view(tick, friendly, enemies = []) {
  return { tick, team: 0, friendlyAssets: friendly, visibleEnemies: enemies, events: [] };
}

test("2C sample before any snapshot returns null", () => {
  const interp = createInterpolator();
  assert.equal(interp.sample(1000), null);
});

test("2C positions interpolate linearly between two snapshots", () => {
  const interp = createInterpolator({ delayMs: 100 });
  interp.push(view(1, [{ id: 0, x: 0, y: 0 }]), 1000);
  interp.push(view(2, [{ id: 0, x: 160, y: 0 }]), 1100);
  // target = 1150 - 100 = 1050 → halfway between the two snapshots
  const sampled = interp.sample(1150);
  assert.equal(sampled.friendlyAssets[0].x, 80);
  assert.equal(sampled.tick, 2, "metadata comes from the newer view");
});

test("2C sample clamps at the newest snapshot when target is beyond it", () => {
  const interp = createInterpolator({ delayMs: 100 });
  interp.push(view(1, [{ id: 0, x: 0, y: 0 }]), 1000);
  interp.push(view(2, [{ id: 0, x: 160, y: 0 }]), 1100);
  const sampled = interp.sample(5000);
  assert.equal(sampled.friendlyAssets[0].x, 160);
});

test("2C entities missing from the newest view never render", () => {
  const interp = createInterpolator({ delayMs: 100 });
  interp.push(view(1, [{ id: 0, x: 0, y: 0 }], [{ id: 4, x: 512, y: 0 }]), 1000);
  interp.push(view(2, [{ id: 0, x: 160, y: 0 }], []), 1100); // enemy fogged out
  const sampled = interp.sample(1150);
  assert.equal(sampled.visibleEnemies.length, 0, "fogged enemy must not linger");
});

test("2C newly appearing entities snap to their first known position", () => {
  const interp = createInterpolator({ delayMs: 100 });
  interp.push(view(1, [{ id: 0, x: 0, y: 0 }]), 1000);
  interp.push(view(2, [{ id: 0, x: 160, y: 0 }], [{ id: 4, x: 512, y: 256 }]), 1100);
  const sampled = interp.sample(1150);
  assert.deepEqual(
    { x: sampled.visibleEnemies[0].x, y: sampled.visibleEnemies[0].y },
    { x: 512, y: 256 },
    "no interpolation from nothing"
  );
});

test("2C out-of-order snapshots are dropped and capacity is bounded", () => {
  const interp = createInterpolator({ delayMs: 0, capacity: 5 });
  interp.push(view(2, [{ id: 0, x: 100, y: 0 }]), 2000);
  interp.push(view(1, [{ id: 0, x: 999, y: 0 }]), 1000); // stale, dropped
  assert.equal(interp.latest().tick, 2);
  for (let i = 0; i < 10; i++) interp.push(view(3 + i, [{ id: 0, x: i, y: 0 }]), 3000 + i * 100);
  assert.equal(interp.sample(99999).tick, 12, "newest survives capacity trimming");
});
