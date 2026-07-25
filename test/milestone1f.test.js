// test/milestone1f.test.js — Milestone 1F: terrain speed + map rendering.
// Rewritten against the reconstructed 1E+1F merged engine: assets follow the
// full authoritative schema and movement runs through advance_tick.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMap, T_OPEN, T_ROAD, T_FOREST, T_ROUGH, T_BLOCKING } from "../engine/mapgen.js";
import { speedMultiplier, TERRAIN_SPEED } from "../engine/terrain.js";
import { apply, createInitialState, BASE_SPEED } from "../engine/reducer.js";
import { ASSET_MOVING } from "../engine/state.js";
import { buildView } from "../engine/view.js";
import { makeAsset, sandbox } from "./helpers.js";

function testAsset(id, team, x, y, targetX, targetY) {
  return makeAsset(id, { team, x, y, targetX, targetY, state: ASSET_MOVING });
}

function openState(width, height) {
  return sandbox([], [], { size: width, seed: 12345 });
}

test("1F terrain speed table has correct values", () => {
  assert.equal(speedMultiplier(T_OPEN), 256);
  assert.equal(speedMultiplier(T_ROAD), 358);
  assert.equal(speedMultiplier(T_FOREST), 179);
  assert.equal(speedMultiplier(T_ROUGH), 128);
  assert.equal(speedMultiplier(T_BLOCKING), 0);
  assert.equal(Object.keys(TERRAIN_SPEED).length, 5);
});

test("1F asset on road tile moves faster than on open tile", () => {
  const state = openState(8, 8);
  state.map.cells[0] = T_ROAD; // (0,0) is road
  state.assets = [
    testAsset(0, 0, 0, 0, 2048, 0),
    testAsset(1, 0, 0, 256, 2048, 256),
  ];

  const after = apply(state, { type: "advance_tick" });
  const roadAsset = after.assets.find((a) => a.id === 0);
  const openAsset = after.assets.find((a) => a.id === 1);

  assert.equal(openAsset.x, BASE_SPEED, "open tile moves at base speed");
  assert.ok(
    roadAsset.x > openAsset.x,
    `road asset x=${roadAsset.x} should be > open asset x=${openAsset.x}`
  );
});

test("1F asset on blocking tile does not move", () => {
  const state = openState(8, 8);
  state.map.cells[0] = T_BLOCKING; // (0,0) is blocking
  state.assets = [testAsset(0, 0, 0, 0, 2048, 0)];

  const after = apply(state, { type: "advance_tick" });
  assert.equal(after.assets[0].x, 0);
});

test("1F view includes mapCells for client terrain rendering", () => {
  const map = generateMap(12345, 8, 8);
  const state = createInitialState(12345, map);

  const view = buildView(state, 0);
  assert.ok(view.mapCells instanceof Uint8Array, "mapCells should be Uint8Array");
  assert.equal(view.mapCells.length, 64);
});

test("1F reducer does not mutate input state with map argument", () => {
  const state = sandbox([], [], { map: generateMap(12345, 8, 8), seed: 12345 });
  state.assets = [testAsset(0, 0, 0, 0, 2048, 0)];

  const stateBefore = JSON.stringify(state);
  const after = apply(state, { type: "advance_tick" });
  const stateAfter = JSON.stringify(state);

  assert.equal(stateAfter, stateBefore, "input state should not be mutated");
  assert.notEqual(after, state, "output should be a new object");
  assert.equal(after.assets[0].x, BASE_SPEED);
});
