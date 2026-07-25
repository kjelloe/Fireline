// test/milestone4d.test.js — Milestone 4D: interpolation polish (headings).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInterpolator } from "../client/js/interpolator.js";

function view(tick, friendly) {
  return { tick, team: 0, friendlyAssets: friendly, visibleEnemies: [], events: [] };
}

test("4D moving entities expose their heading, stationary ones do not", () => {
  const interp = createInterpolator({ delayMs: 100 });
  interp.push(view(1, [{ id: 0, x: 0, y: 0 }, { id: 1, x: 500, y: 500 }]), 1000);
  interp.push(view(2, [{ id: 0, x: 160, y: 0 }, { id: 1, x: 500, y: 500 }]), 1100);
  const sampled = interp.sample(1150);
  assert.equal(sampled.friendlyAssets[0].heading, 0, "eastbound = 0 rad");
  assert.equal(sampled.friendlyAssets[1].heading, null, "no motion, renderer keeps last");
});

test("4D heading tracks all four cardinal directions", () => {
  const dirs = [
    { dx: 160, dy: 0, want: 0 },
    { dx: 0, dy: 160, want: Math.PI / 2 },
    { dx: -160, dy: 0, want: Math.PI },
    { dx: 0, dy: -160, want: -Math.PI / 2 },
  ];
  for (const d of dirs) {
    const interp = createInterpolator({ delayMs: 100 });
    interp.push(view(1, [{ id: 0, x: 1000, y: 1000 }]), 1000);
    interp.push(view(2, [{ id: 0, x: 1000 + d.dx, y: 1000 + d.dy }]), 1100);
    assert.equal(interp.sample(1150).friendlyAssets[0].heading, d.want);
  }
});
