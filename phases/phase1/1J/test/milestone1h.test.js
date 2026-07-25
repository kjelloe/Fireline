// test/milestone1h.test.js — Milestone 1H: Fog of War + LOS

import { test } from 'node:test';
import assert from 'node:assert';
import { computeVisible } from '../engine/los.js';
import { buildView } from '../engine/view.js';
import { ASSET_ACTIVE, ASSET_SUPPRESSED, ASSET_DISABLED } from '../engine/state.js';

test('1H enemy asset outside fog radius is hidden in view', () => {
  const map = { width: 20, height: 20, cells: new Uint8Array(400), seed: 1 };
  const state = {
    tick: 0, map, sites: [],
    operators: [{ id: 'op0', team: 0 }],
    assets: [
      { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE },
      { id: 1, team: 1, x: 5000, y: 0, status: ASSET_ACTIVE } // Way outside 6-cell (1536) radius
    ]
  };

  const view = buildView(state, 'op0');
  const enemy = view.assets.find(a => a.id === 1);
  assert.strictEqual(enemy, undefined, 'Enemy should be hidden by fog');
});

test('1H enemy asset inside fog radius is visible in view', () => {
  const map = { width: 20, height: 20, cells: new Uint8Array(400), seed: 1 };
  const state = {
    tick: 0, map, sites: [],
    operators: [{ id: 'op0', team: 0 }],
    assets: [
      { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE },
      { id: 1, team: 1, x: 512, y: 0, status: ASSET_ACTIVE } // Inside 1536 radius
    ]
  };

  const view = buildView(state, 'op0');
  const enemy = view.assets.find(a => a.id === 1);
  assert.notStrictEqual(enemy, undefined, 'Enemy should be visible in fog');
});

test('1H suppressed asset has reduced visibility radius', () => {
  const map = { width: 20, height: 20, cells: new Uint8Array(400), seed: 1 };
  const state = {
    tick: 0, map, sites: [],
    operators: [{ id: 'op0', team: 0 }],
    assets: [
      { id: 0, team: 0, x: 0, y: 0, status: ASSET_SUPPRESSED },
      { id: 1, team: 1, x: 1024, y: 0, status: ASSET_ACTIVE } // Outside 3-cell (768) radius
    ]
  };

  const view = buildView(state, 'op0');
  const enemy = view.assets.find(a => a.id === 1);
  assert.strictEqual(enemy, undefined, 'Enemy should be hidden because observer is suppressed');
});

test('1H disabled wreck remains visible regardless of fog distance', () => {
  const map = { width: 20, height: 20, cells: new Uint8Array(400), seed: 1 };
  const state = {
    tick: 0, map, sites: [],
    operators: [{ id: 'op0', team: 0 }],
    assets: [
      { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE },
      { id: 1, team: 1, x: 5000, y: 0, status: ASSET_DISABLED } 
    ]
  };

  const view = buildView(state, 'op0');
  const enemy = view.assets.find(a => a.id === 1);
  assert.notStrictEqual(enemy, undefined, 'Disabled wrecks should be visible (terrain feature)');
});
