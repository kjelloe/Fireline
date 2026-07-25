// test/milestone1k.test.js — Milestone 1K: Deterministic Replay Log

import { test } from 'node:test';
import assert from 'node:assert';
import { apply, createInitialState } from '../engine/reducer.js';
import { replay } from '../engine/replay.js';
import { ASSET_ACTIVE } from '../engine/state.js';

test('1K commands are recorded in state log', () => {
  const map = { width: 8, height: 8, cells: new Uint8Array(64), seed: 1 };
  let state = createInitialState(1, map);
  state = apply(state, { type: 'tick' });
  assert.strictEqual(state.commands.length, 1);
  assert.strictEqual(state.commands[0].type, 'tick');
});

test('1K replay produces identical state', () => {
  const map = { width: 8, height: 8, cells: new Uint8Array(64), seed: 1 };
  const initial = createInitialState(1, map);
  initial.assets = [
    { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, hp: 100, speed: 100, targetX: 1000, targetY: 0 }
  ];
  initial.sites = [
    { id: 's0', x: 0, y: 0, team: 0, type: 'relay' }
  ];

  let state = initial;
  for (let i = 0; i < 5; i++) {
    state = apply(state, { type: 'tick' });
  }

  const replayed = replay(initial, state.commands);
  assert.strictEqual(replayed.tick, state.tick);
  assert.strictEqual(replayed.assets[0].x, state.assets[0].x);
  assert.strictEqual(replayed.assets[0].y, state.assets[0].y);
  assert.strictEqual(replayed.commands.length, state.commands.length);
});

test('1K replay with different commands produces different state', () => {
  const map = { width: 8, height: 8, cells: new Uint8Array(64), seed: 1 };
  const initial = createInitialState(1, map);
  initial.assets = [
    { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, hp: 100, speed: 100, targetX: 1000, targetY: 0 }
  ];
  initial.sites = [
    { id: 's0', x: 0, y: 0, team: 0, type: 'relay' }
  ];

  let stateA = initial;
  for (let i = 0; i < 3; i++) {
    stateA = apply(stateA, { type: 'tick' });
  }

  let stateB = initial;
  for (let i = 0; i < 5; i++) {
    stateB = apply(stateB, { type: 'tick' });
  }

  const replayedA = replay(initial, stateA.commands);
  const replayedB = replay(initial, stateB.commands);

  assert.strictEqual(replayedA.tick, 3);
  assert.strictEqual(replayedB.tick, 5);
  assert.notStrictEqual(replayedA.tick, replayedB.tick);
});

test('1K replay does not mutate initial state', () => {
  const map = { width: 8, height: 8, cells: new Uint8Array(64), seed: 1 };
  const initial = createInitialState(1, map);
  initial.assets = [
    { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, hp: 100 }
  ];
  const commands = [
    { type: 'tick' },
    { type: 'tick' }
  ];

  const initialTick = initial.tick;
  const initialAssetX = initial.assets[0].x;

  replay(initial, commands);

  assert.strictEqual(initial.tick, initialTick);
  assert.strictEqual(initial.assets[0].x, initialAssetX);
  assert.strictEqual(initial.commands.length, 0);
});
