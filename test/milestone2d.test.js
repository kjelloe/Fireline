// test/milestone2d.test.js — Milestone 2D: input → command mapping.
// The client proposes commands only; these tests pin the mapping rules.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scenePointToCell, clampCell, buildCommandForClick, buildSelectCommand, enemyAtCell,
} from "../client/js/input_mapper.js";

const DISABLED = 2;

function view(enemies) {
  return { visibleEnemies: enemies };
}

test("2D scene points floor to cells and clamp to map bounds", () => {
  assert.deepEqual(scenePointToCell(10.7, 55.2), { cellX: 10, cellY: 55 });
  assert.deepEqual(scenePointToCell(-3, 500), { cellX: 0, cellY: 127 });
  assert.equal(clampCell(127.9), 127);
});

test("2D clicking empty ground builds a move_order", () => {
  const cmd = buildCommandForClick(view([]), 20, 56);
  assert.deepEqual(cmd, { type: "move_order", targetCellX: 20, targetCellY: 56 });
});

test("2D clicking a visible live enemy builds a fire_order", () => {
  const cmd = buildCommandForClick(view([{ id: 4, x: 20 * 256, y: 56 * 256, state: 0 }]), 20, 56);
  assert.deepEqual(cmd, { type: "fire_order", targetAssetId: 4 });
});

test("2D clicking a wreck moves instead of firing", () => {
  const cmd = buildCommandForClick(
    view([{ id: 4, x: 20 * 256, y: 56 * 256, state: DISABLED }]), 20, 56
  );
  assert.equal(cmd.type, "move_order");
});

test("2D fire radius option tolerates near-miss clicks deterministically", () => {
  const enemies = [
    { id: 7, x: 21 * 256, y: 56 * 256, state: 0 },
    { id: 4, x: 20 * 256, y: 57 * 256, state: 0 },
  ];
  const cmd = buildCommandForClick(view(enemies), 20, 56, { fireRadiusCells: 1 });
  assert.deepEqual(cmd, { type: "fire_order", targetAssetId: 4 }, "lowest id wins ties");
  assert.equal(enemyAtCell(view(enemies), 10, 10, 1), null);
});

test("2D select command shape", () => {
  assert.deepEqual(buildSelectCommand(3), { type: "select_asset", assetId: 3 });
});

test("prompt 214: off-map taps are DROPPED, never clamped to the edge", async () => {
  const { scenePointToCell } = await import("../client/js/input_mapper.js");
  // The runaway-corner bug: a tap whose ground ray landed outside the
  // map was clamped to the edge, manufacturing a corner move-order the
  // player never gave — and every further tap clamped to the SAME
  // corner ("a target I could not reset").
  assert.equal(scenePointToCell(-40, 300, { strict: true }), null, "far off-map: no order");
  assert.equal(scenePointToCell(500, 64, { strict: true }), null);
  assert.deepEqual(scenePointToCell(-0.3, 64, { strict: true }), { cellX: 0, cellY: 64 },
    "half-cell edge overshoot forgiven");
  assert.deepEqual(scenePointToCell(-40, 300), { cellX: 0, cellY: 127 },
    "legacy non-strict callers keep the clamp");
});
