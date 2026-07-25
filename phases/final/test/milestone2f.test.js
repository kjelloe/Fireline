// test/milestone2f.test.js — Final Integration Test
import { test } from 'node:test';
import assert from 'node:assert';
import { apply, createInitialState } from '../engine/reducer.js';

test('2F vertical slice: networking-state bridge (JOIN_INTERNAL)', (t) => {
  const map = { width: 4, height: 4, cells: new Uint8Array(16), seed: 1 };
  let state = createInitialState(1, map);

  // Verify that the server command JOIN_INTERNAL correctly registers an operator
  state = apply(state, { type: 'JOIN_INTERNAL', opId: 'net_player_1', team: 0 });

  const op = state.operators.find(o => o.id === 'net_player_1');
  assert.ok(op, 'Operator should be persistent in state for view culling');
  assert.strictEqual(op.team, 0);
});
