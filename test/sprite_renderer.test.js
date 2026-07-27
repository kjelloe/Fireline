// test/sprite_renderer.test.js — 14D fallback draw-list: fog-honest,
// z-ordered, heading-aware. Pure over a synthetic view.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDrawList } from "../client/js/sprite_renderer.js";

const view = {
  sites: [{ id: 0, owner: 1, cellX: 32, cellY: 63 }],
  mines: [{ team: 0, x: 10 * 256, y: 10 * 256 }],
  standards: [{ team: 0, status: 1, x: 7 * 256, y: 63 * 256 }],
  downed: [{ team: 1, x: 20 * 256, y: 20 * 256 }],
  friendlyAssets: [{ id: 1, team: 0, x: 12 * 256, y: 12 * 256, heading: 64, state: 0, type: 0 }],
  visibleEnemies: [{ id: 9, team: 1, x: 40 * 256, y: 12 * 256, heading: 128, state: 3, type: 1 }],
  drones: [{ team: 1, x: 15 * 256, y: 15 * 256 }],
};

test("draw list: everything visible, nothing else, ground before hulls", () => {
  const ops = buildDrawList(view);
  assert.deepEqual(ops.map((o) => o.key), [
    "relay", "mine", "standard_upright", "operator_down",
    "tank", "wreck_scout", "drone",
  ]);
  assert.equal(ops[0].team, 1, "relay tinted by owner");
  const tank = ops.find((o) => o.key === "tank");
  assert.deepEqual([tank.x, tank.y, tank.brads], [12.5, 12.5, 64]);
});

test("draw list: wrecked enemies resolve to wreck sprites (state contract)", () => {
  const wreck = buildDrawList(view).find((o) => o.key === "wreck_scout");
  assert.ok(wreck, "STATE 3 (disabled) picks the wreck sheet");
});

test("empty and null views draw nothing", () => {
  assert.deepEqual(buildDrawList(null), []);
  assert.deepEqual(buildDrawList({}), []);
});
