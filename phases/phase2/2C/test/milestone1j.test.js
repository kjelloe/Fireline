// test/milestone1j.test.js — Milestone 1J: Supply & Attrition

import { test } from 'node:test';
import assert from 'node:assert';
import { apply } from '../engine/reducer.js';
import { buildView } from '../engine/view.js';
import { inSupply } from '../engine/supply.js';
import { ASSET_ACTIVE, ASSET_DISABLED } from '../engine/state.js';

test('1J asset inside friendly relay radius is in supply', () => {
  const map = { width: 10, height: 10, cells: new Uint8Array(100), seed: 1 };
  const state = {
    tick: 0, map, operators: [],
    assets: [{ id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, hp: 100 }],
    sites: [{ id: 's0', x: 0, y: 0, team: 0, type: 'relay' }]
  };
  assert.strictEqual(inSupply(state, state.assets[0]), true);
});

test('1J asset outside friendly relay radius is not in supply', () => {
  const map = { width: 10, height: 10, cells: new Uint8Array(100), seed: 1 };
  const state = {
    tick: 0, map, operators: [],
    assets: [{ id: 0, team: 0, x: 5000, y: 0, status: ASSET_ACTIVE, hp: 100 }],
    sites: [{ id: 's0', x: 0, y: 0, team: 0, type: 'relay' }]
  };
  assert.strictEqual(inSupply(state, state.assets[0]), false);
});

test('1J out-of-supply asset cannot fire', () => {
  const map = { width: 10, height: 10, cells: new Uint8Array(100), seed: 1 };
  const state = {
    tick: 0, map, operators: [],
    assets: [
      { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, hp: 100 },
      { id: 1, team: 1, x: 256, y: 0, status: ASSET_ACTIVE, hp: 100 }
    ],
    sites: [] // No supply source
  };
  const after = apply(state, { type: 'FIRE', assetId: 0, targetId: 1 });
  assert.strictEqual(after.assets[1].hp, 100, 'target should be unharmed');
});

test('1J out-of-supply asset moves slower', () => {
  const map = { width: 10, height: 10, cells: new Uint8Array(100).fill(0), seed: 1 };
  const supplied = {
    tick: 0, map, operators: [],
    assets: [{ id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, speed: 100, targetX: 1000, targetY: 0 }],
    sites: [{ id: 's0', x: 0, y: 0, team: 0, type: 'relay' }]
  };
  const unsupplied = {
    tick: 0, map, operators: [],
    assets: [{ id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, speed: 100, targetX: 1000, targetY: 0 }],
    sites: []
  };
  const afterSupplied = apply(supplied, { type: 'tick' });
  const afterUnsupplied = apply(unsupplied, { type: 'tick' });
  assert.ok(afterUnsupplied.assets[0].x < afterSupplied.assets[0].x, 'unsupplied asset should move slower');
});

test('1J attrition disables asset after 20 ticks out of supply', () => {
  const map = { width: 10, height: 10, cells: new Uint8Array(100), seed: 1 };
  let state = {
    tick: 0, map, operators: [],
    assets: [{ id: 0, team: 0, x: 5000, y: 0, status: ASSET_ACTIVE, hp: 10 }],
    sites: []
  };
  for (let i = 0; i < 20; i++) {
    state = apply(state, { type: 'tick' });
  }
  assert.strictEqual(state.assets[0].hp, 0);
  assert.strictEqual(state.assets[0].status, ASSET_DISABLED);
});

test('1J view includes inSupply flag for own assets', () => {
  const map = { width: 10, height: 10, cells: new Uint8Array(100), seed: 1 };
  const state = {
    tick: 0, map, operators: [{ id: 'op0', team: 0 }],
    assets: [{ id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, hp: 100 }],
    sites: [{ id: 's0', x: 0, y: 0, team: 0, type: 'relay' }]
  };
  const view = buildView(state, 'op0');
  assert.strictEqual(view.assets[0].inSupply, true);
});
