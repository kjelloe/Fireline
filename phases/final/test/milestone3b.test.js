// test/milestone3b.test.js — Milestone 3B: Base & Supply Logic
import { test } from 'node:test';
import assert from 'node:assert';
import { inSupply } from '../engine/supply.js';

function makeAsset(team, x, y) { return { team, x, y }; }
function makeSite(team, x, y, type) { return { team, x, y, type }; }

test('3B relay provides standard supply radius', () => {
  const asset = makeAsset(0, 5 * 256, 0); // Exactly 5 cells away
  const relay = makeSite(0, 0, 0, 'RELAY');

  assert.strictEqual(inSupply({ sites: [relay] }, asset), true, 'Asset at edge of 5-cell relay radius is supplied');
});

test('3B base provides wider supply radius than relay', () => {
  const asset = makeAsset(0, 8 * 256, 0); // 8 cells away
  const relay = makeSite(0, 0, 0, 'RELAY');
  const base = makeSite(0, 0, 0, 'BASE');

  assert.strictEqual(inSupply({ sites: [relay] }, asset), false, 'Asset 8 cells from relay is out of supply');
  assert.strictEqual(inSupply({ sites: [base] }, asset), true, 'Asset 8 cells from base is in supply');
});

test('3B enemy sites do not provide supply', () => {
  const asset = makeAsset(0, 0, 0);
  const enemyBase = makeSite(1, 0, 0, 'BASE');

  assert.strictEqual(inSupply({ sites: [enemyBase] }, asset), false, 'Enemy base should not supply our asset');
});
