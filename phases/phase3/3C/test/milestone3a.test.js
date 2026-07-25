// test/milestone3a.test.js — Milestone 3A: Unit Roster & Stats
import { test } from 'node:test';
import assert from 'node:assert';
import { getUnitStats, createAsset } from '../engine/units.js';

test('3A unit database provides distinct stats', () => {
  const tank = getUnitStats('TANK');
  const scout = getUnitStats('SCOUT');

  assert.ok(scout.speed > tank.speed, 'Scouts should be faster than tanks');
  assert.ok(tank.hp > scout.hp, 'Tanks should have more HP than scouts');
});

test('3A createAsset initializes from stats', () => {
  const arty = createAsset('A1', 'ARTILLERY', 1, 100, 100);
  const stats = getUnitStats('ARTILLERY');

  assert.strictEqual(arty.type, 'ARTILLERY');
  assert.strictEqual(arty.hp, stats.hp);
  assert.strictEqual(arty.maxHp, stats.hp);
});
