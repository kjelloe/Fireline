// test/milestone1g.test.js — Milestone 1G: Combat + HP + Disablement

import { test } from 'node:test';
import assert from 'node:assert';
import { apply } from '../engine/reducer.js';
import { ASSET_ACTIVE, ASSET_DISABLED } from '../engine/state.js';
import { resolveShot } from '../engine/combat.js';

test('1G resolveShot reduces HP by expected delta', () => {
  const result = resolveShot({}, {});
  assert.strictEqual(result.hpDelta, 20);
});

test('1G repeated fire disables asset at HP=0', () => {
  const map = { width: 8, height: 8, cells: new Uint8Array(64), seed: 1 };
  let state = {
    tick: 0, map, operators: [],
    sites: [{ id: 's0', x: 0, y: 0, team: 0, type: 'relay' }],
    assets: [
      { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, hp: 100 },
      { id: 1, team: 1, x: 256, y: 0, status: ASSET_ACTIVE, hp: 40 }
    ]
  };

  // Fire 1
  state = apply(state, { type: 'FIRE', assetId: 0, targetId: 1 });
  assert.strictEqual(state.assets[1].hp, 20);
  assert.strictEqual(state.assets[1].status, ASSET_ACTIVE);

  // Fire 2
  state = apply(state, { type: 'FIRE', assetId: 0, targetId: 1 });
  assert.strictEqual(state.assets[1].hp, 0);
  assert.strictEqual(state.assets[1].status, ASSET_DISABLED);
});

test('1G disabled asset cannot move/fire', () => {
  const map = { width: 8, height: 8, cells: new Uint8Array(64), seed: 1 };
  const state = {
    tick: 0, map, operators: [],
    assets: [
      { id: 0, team: 0, x: 0, y: 0, status: ASSET_DISABLED, hp: 0, speed: 100, targetX: 1000, targetY: 0 },
      { id: 1, team: 1, x: 256, y: 0, status: ASSET_ACTIVE, hp: 100 }
    ]
  };

  const afterTick = apply(state, { type: 'tick' });
  assert.strictEqual(afterTick.assets[0].x, 0, 'disabled asset should not move');

  const afterFire = apply(state, { type: 'FIRE', assetId: 0, targetId: 1 });
  assert.strictEqual(afterFire.assets[1].hp, 100, 'disabled asset should not damage target');
});

test('1G fire command rejected for out-of-range target', () => {
  const map = { width: 8, height: 8, cells: new Uint8Array(64), seed: 1 };
  const state = {
    tick: 0, map, operators: [],
    assets: [
      { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, hp: 100 },
      { id: 1, team: 1, x: 5000, y: 0, status: ASSET_ACTIVE, hp: 100 } // Dist = 5000 > 1280
    ]
  };
  const after = apply(state, { type: 'FIRE', assetId: 0, targetId: 1 });
  assert.strictEqual(after.assets[1].hp, 100);
});
