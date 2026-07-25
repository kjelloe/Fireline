// test/milestone1f.test.js — Milestone 1F: Terrain Speed + Map Rendering

import { test } from 'node:test';
import assert from 'node:assert';
import { generateMap, T_OPEN, T_ROAD, T_FOREST, T_ROUGH, T_BLOCKING } from '../engine/mapgen.js';
import { speedMultiplier, TERRAIN_SPEED } from '../engine/terrain.js';
import { apply, createInitialState } from '../engine/reducer.js';
import { buildView } from '../engine/view.js';

test('1F terrain speed table has correct values', () => {
  assert.strictEqual(speedMultiplier(T_OPEN), 256);
  assert.strictEqual(speedMultiplier(T_ROAD), 358);
  assert.strictEqual(speedMultiplier(T_FOREST), 179);
  assert.strictEqual(speedMultiplier(T_ROUGH), 128);
  assert.strictEqual(speedMultiplier(T_BLOCKING), 0);
});

test('1F asset on road tile moves faster than on open tile', () => {
  const map = {
    width: 8,
    height: 8,
    cells: new Uint8Array(64).fill(T_OPEN),
    seed: 12345,
  };
  map.cells[0] = T_ROAD; // (0,0) is road

  const state = createInitialState(12345, map);
  state.assets = [
    { id: 0, team: 0, x: 0, y: 0, speed: 16, status: 0, targetX: 2048, targetY: 0 },
    { id: 1, team: 0, x: 0, y: 256, speed: 16, status: 0, targetX: 2048, targetY: 256 },
  ];

  const after = apply(state, { type: 'tick' });
  const roadAsset = after.assets.find(a => a.id === 0);
  const openAsset = after.assets.find(a => a.id === 1);

  assert.ok(
    roadAsset.x > openAsset.x,
    `road asset x=${roadAsset.x} should be > open asset x=${openAsset.x}`
  );
});

test('1F asset on blocking tile does not move', () => {
  const map = {
    width: 8,
    height: 8,
    cells: new Uint8Array(64).fill(T_OPEN),
    seed: 12345,
  };
  map.cells[0] = T_BLOCKING; // (0,0) is blocking

  const state = createInitialState(12345, map);
  state.assets = [
    { id: 0, team: 0, x: 0, y: 0, speed: 16, status: 0, targetX: 2048, targetY: 0 },
  ];

  const after = apply(state, { type: 'tick' });
  const asset = after.assets.find(a => a.id === 0);
  assert.strictEqual(asset.x, 0);
});

test('1F view includes mapCells for client terrain rendering', () => {
  const map = generateMap(12345, 8, 8);
  const state = createInitialState(12345, map);
  state.operators = [{ id: 'op0', team: 0, assetIds: [] }];

  const view = buildView(state, 'op0');
  assert.ok(view.mapCells instanceof Uint8Array, 'mapCells should be Uint8Array');
  assert.strictEqual(view.mapCells.length, 64);
});

test('1F reducer does not mutate input state with map argument', () => {
  const map = generateMap(12345, 8, 8);
  const state = createInitialState(12345, map);
  state.assets = [
    { id: 0, team: 0, x: 0, y: 0, speed: 16, status: 0, targetX: 2048, targetY: 0 },
  ];
  state.operators = [{ id: 'op0', team: 0, assetIds: [0] }];

  const stateBefore = JSON.stringify(state);
  const after = apply(state, { type: 'tick' });
  const stateAfter = JSON.stringify(state);

  assert.strictEqual(stateAfter, stateBefore, 'input state should not be mutated');
  assert.notStrictEqual(after, state, 'output should be a new object');
});
