// test/milestone3e.test.js — Milestone 3E: Victory Conditions
import { test } from 'node:test';
import assert from 'node:assert';
import { checkVictory } from '../engine/victory.js';

test('3E no winner when both teams have active assets', () => {
  const state = {
    assets: [
      { id: 'A0', team: 0, status: 0 },
      { id: 'A1', team: 1, status: 0 }
    ],
    sites: []
  };
  const result = checkVictory(state);
  assert.strictEqual(result.winner, null);
});

test('3E annihilation: team 1 wins when team 0 has no active assets', () => {
  const state = {
    assets: [
      { id: 'A0', team: 0, status: 2 }, // DISABLED
      { id: 'A1', team: 1, status: 0 }
    ],
    sites: []
  };
  const result = checkVictory(state);
  assert.strictEqual(result.winner, 1);
  assert.strictEqual(result.reason, 'annihilation');
});

test('3E domination: team 0 wins when controlling all bases', () => {
  const state = {
    assets: [
      { id: 'A0', team: 0, status: 0 },
      { id: 'A1', team: 1, status: 0 }
    ],
    sites: [
      { id: 'S0', type: 'BASE', team: 0 },
      { id: 'S1', type: 'BASE', team: 0 }
    ]
  };
  const result = checkVictory(state);
  assert.strictEqual(result.winner, 0);
  assert.strictEqual(result.reason, 'domination');
});

test('3E no domination when bases are split', () => {
  const state = {
    assets: [
      { id: 'A0', team: 0, status: 0 },
      { id: 'A1', team: 1, status: 0 }
    ],
    sites: [
      { id: 'S0', type: 'BASE', team: 0 },
      { id: 'S1', type: 'BASE', team: 1 }
    ]
  };
  const result = checkVictory(state);
  assert.strictEqual(result.winner, null);
});
