// test/milestone6a.test.js — Milestone 6A: Delta Encoding
import { test } from 'node:test';
import assert from 'node:assert';
import { encodeDelta, applyDelta } from '../shared/delta_encoder.js';

test('6A encodeDelta detects new units', () => {
  const prev = { tick: 0, units: [] };
  const curr = { tick: 1, units: [{ id: 'u1', x: 10, y: 10 }] };

  const delta = encodeDelta(prev, curr);
  assert.strictEqual(delta.changes.length, 1);
  assert.strictEqual(delta.changes[0].type, 'UNIT_SPAWN');
});

test('6A encodeDelta detects destroyed units', () => {
  const prev = { tick: 0, units: [{ id: 'u1', x: 10, y: 10 }] };
  const curr = { tick: 1, units: [] };

  const delta = encodeDelta(prev, curr);
  assert.strictEqual(delta.changes.length, 1);
  assert.strictEqual(delta.changes[0].type, 'UNIT_DESTROY');
});

test('6A applyDelta correctly updates state', () => {
  const state = { tick: 0, units: [{ id: 'u1', x: 0, y: 0 }] };
  const delta = { 
    tick: 1, 
    changes: [{ type: 'UNIT_UPDATE', id: 'u1', data: { id: 'u1', x: 5, y: 5 } }] 
  };

  const newState = applyDelta(state, delta);
  assert.strictEqual(newState.units[0].x, 5);
  assert.strictEqual(newState.tick, 1);
});
