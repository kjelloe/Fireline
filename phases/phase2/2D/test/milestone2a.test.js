// test/milestone2a.test.js — Milestone 2A: Integration (Tick Loop & Multi-Role)

import { test } from 'node:test';
import assert from 'node:assert';
import { apply, createInitialState } from '../engine/reducer.js';
import { joinWorld } from '../engine/operators.js';
import { startServerLoop } from '../server/clock.js';

test('2A joinWorld adds operator to active world state', () => {
  const map = { width: 8, height: 8, cells: new Uint8Array(64), seed: 1 };
  let state = createInitialState(1, map);

  state = joinWorld(state, 'player1', 0);
  assert.strictEqual(state.operators.length, 1);
  assert.strictEqual(state.operators[0].id, 'player1');
  assert.strictEqual(state.operators[0].team, 0);
});

test('2A server clock increments ticks at 10Hz (mocked interval)', async () => {
  const map = { width: 8, height: 8, cells: new Uint8Array(64), seed: 1 };
  const initial = createInitialState(1, map);

  const loop = startServerLoop(initial, apply);

  // Wait ~250ms for at least 2 ticks
  await new Promise(r => setTimeout(r, 250));

  const finalState = loop.getState();
  loop.stop();

  assert.ok(finalState.tick >= 2, `Expected at least 2 ticks, got ${finalState.tick}`);
});

test('2A command dispatch updates loop state immediately', () => {
  const map = { width: 8, height: 8, cells: new Uint8Array(64), seed: 1 };
  const initial = createInitialState(1, map);
  const loop = startServerLoop(initial, apply);

  loop.dispatch({ type: 'CAPTURE', assetId: 0, siteId: 'relay_alpha' }); // Note: site might not exist, but command is logged

  const state = loop.getState();
  loop.stop();

  assert.strictEqual(state.commands.length, 1);
  assert.strictEqual(state.commands[0].type, 'CAPTURE');
});
