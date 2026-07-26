// test/milestone8g.test.js — Milestone 8G: free camera + click-select/order UX.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createCamera, panForKey } from "../client/js/camera_model.js";
import { buildCommandForClick } from "../client/js/input_mapper.js";

const CELL = 256;

test("8G camera pans with clamping and leaves follow mode", () => {
  const cam = createCamera({ mapSize: 128, x: 64, y: 64 });
  assert.equal(cam.state.follow, true);
  cam.pan(10, -100);
  assert.deepEqual({ x: cam.state.x, y: cam.state.y }, { x: 74, y: 0 }, "clamped at map edge");
  assert.equal(cam.state.follow, false, "manual pan breaks follow");
  cam.trackIfFollowing(30, 30);
  assert.equal(cam.state.x, 74, "no tracking while free");
  cam.followMode(true);
  cam.trackIfFollowing(30, 30);
  assert.equal(cam.state.x, 30, "tracking resumes");
});

test("8G zoom clamps to sane bounds", () => {
  const cam = createCamera({ zoom: 18 });
  cam.zoomBy(0.5); cam.zoomBy(0.5); cam.zoomBy(0.01);
  assert.equal(cam.state.zoom, 6, "min zoom floor");
  cam.zoomBy(1000);
  assert.equal(cam.state.zoom, 64, "max zoom ceiling");
});

test("8G WASD and arrows map to pan deltas", () => {
  assert.deepEqual(panForKey("w"), { dx: 0, dy: -3 });
  assert.deepEqual(panForKey("ArrowRight"), { dx: 3, dy: 0 });
  assert.deepEqual(panForKey("ArrowDown", 5), { dx: 0, dy: 5 });
  assert.equal(panForKey("q"), null);
});

test("8G click priority: select free friendly > fire enemy > tow wreck > move", () => {
  const view = {
    friendlyAssets: [
      { id: 3, state: 0, operatorId: -1, x: 5 * CELL, y: 5 * CELL, towedBy: -1, recoverTimer: 0 },
      { id: 4, state: 2, operatorId: -1, x: 6 * CELL, y: 5 * CELL, towedBy: -1, recoverTimer: 0 },
      { id: 5, state: 0, operatorId: 0, x: 7 * CELL, y: 5 * CELL, towedBy: -1, recoverTimer: 0 },
    ],
    visibleEnemies: [{ id: 20, state: 0, x: 6 * CELL, y: 5 * CELL }],
  };
  const opts = { myOperatorId: 0 };

  assert.deepEqual(buildCommandForClick(view, 5, 5, opts), { type: "select_asset", assetId: 3 });
  assert.deepEqual(buildCommandForClick(view, 6, 5, opts), { type: "fire_order", targetAssetId: 20 },
    "enemy on the wreck's cell outranks the tow");
  assert.deepEqual(buildCommandForClick(view, 7, 5, opts), { type: "move_order", targetCellX: 7, targetCellY: 5 },
    "clicking your own driven asset is just a move");
});

test("8G clicking a clean wreck orders a tow; recovering wrecks are left alone", () => {
  const view = {
    friendlyAssets: [
      { id: 4, state: 2, operatorId: -1, x: 6 * CELL, y: 5 * CELL, towedBy: -1, recoverTimer: 0 },
      { id: 6, state: 2, operatorId: -1, x: 8 * CELL, y: 5 * CELL, towedBy: -1, recoverTimer: 40 },
    ],
    visibleEnemies: [],
  };
  assert.deepEqual(buildCommandForClick(view, 6, 5, { myOperatorId: 0, canTow: true }),
    { type: "tow_order", wreckAssetId: 4 });
  assert.equal(buildCommandForClick(view, 6, 5, { myOperatorId: 0, canTow: false }).type,
    "move_order", "non-truck drivers get a move, not a doomed tow");
  assert.deepEqual(buildCommandForClick(view, 8, 5, { myOperatorId: 0, canTow: true }).type, "move_order");
});

test("8G teammate-operated assets are not select targets", () => {
  const view = {
    friendlyAssets: [
      { id: 9, state: 0, operatorId: 5, x: 3 * CELL, y: 3 * CELL, towedBy: -1, recoverTimer: 0 },
    ],
    visibleEnemies: [],
  };
  assert.equal(buildCommandForClick(view, 3, 3, { myOperatorId: 0 }).type, "move_order");
});

test("9G clicking an enemy drone fires at it, above any asset on the cell", () => {
  const view = {
    team: 0,
    friendlyAssets: [],
    visibleEnemies: [{ id: 20, state: 0, x: 6 * CELL, y: 5 * CELL }],
    drones: [
      { id: 2, team: 1, x: 6 * CELL, y: 5 * CELL },
      { id: 3, team: 0, x: 7 * CELL, y: 5 * CELL }, // friendly drone: never a target
    ],
  };
  assert.deepEqual(buildCommandForClick(view, 6, 5, { myOperatorId: 0 }),
    { type: "fire_order", targetDroneId: 2 });
  assert.equal(buildCommandForClick(view, 7, 5, { myOperatorId: 0 }).type, "move_order");
});
