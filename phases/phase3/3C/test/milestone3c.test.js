// test/milestone3c.test.js — Milestone 3C: AI Regency
import { test } from 'node:test';
import assert from 'node:assert';
import { regentCommands } from '../server/ai_regent.js';

function makeState({ assets = [], sites = [], operators = [] } = {}) {
  return { assets, sites, operators };
}

test('3C regent issues MOVE toward enemy base when no enemy in range', () => {
  const state = makeState({
    operators: [{ id: 'bot1', team: 0 }],
    assets: [{ id: 'A0', type: 'TANK', team: 0, status: 0, x: 0, y: 0 }],
    sites: [{ id: 'S1', type: 'BASE', team: 1, x: 10 * 256, y: 0 }]
  });

  const cmds = regentCommands(state, 'bot1');
  assert.strictEqual(cmds.length, 1);
  assert.strictEqual(cmds[0].type, 'MOVE');
  assert.strictEqual(cmds[0].target.x, 10 * 256);
});

test('3C regent issues FIRE when enemy is in range', () => {
  const state = makeState({
    operators: [{ id: 'bot1', team: 0 }],
    assets: [
      { id: 'A0', type: 'TANK', team: 0, status: 0, x: 0, y: 0 },
      { id: 'A1', type: 'TANK', team: 1, status: 0, x: 2 * 256, y: 0 } // 2 cells away, within 5-cell range
    ],
    sites: []
  });

  const cmds = regentCommands(state, 'bot1');
  assert.strictEqual(cmds.length, 1);
  assert.strictEqual(cmds[0].type, 'FIRE');
  assert.strictEqual(cmds[0].targetId, 'A1');
});

test('3C regent issues no commands for unknown operator', () => {
  const state = makeState({ operators: [], assets: [] });
  const cmds = regentCommands(state, 'ghost');
  assert.strictEqual(cmds.length, 0);
});
