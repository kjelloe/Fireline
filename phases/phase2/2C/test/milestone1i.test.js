// test/milestone1i.test.js — Milestone 1I: Relay Sites + Capture + Fog Extension

import { test } from 'node:test';
import assert from 'node:assert';
import { apply } from '../engine/reducer.js';
import { buildView } from '../engine/view.js';
import { ASSET_ACTIVE } from '../engine/state.js';

test('1I capture command assigns site to team', () => {
  const map = { width: 10, height: 10, cells: new Uint8Array(100), seed: 1 };
  const state = {
    tick: 0, map, operators: [],
    assets: [
      { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, hp: 100 }
    ],
    sites: [
      { id: 's0', x: 0, y: 0, team: -1, type: 'relay' }
    ]
  };
  const after = apply(state, { type: 'CAPTURE', assetId: 0, siteId: 's0' });
  assert.strictEqual(after.sites[0].team, 0);
});

test('1I capture fails if asset is too far from site', () => {
  const map = { width: 10, height: 10, cells: new Uint8Array(100), seed: 1 };
  const state = {
    tick: 0, map, operators: [],
    assets: [
      { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, hp: 100 }
    ],
    sites: [
      { id: 's0', x: 1000, y: 0, team: -1, type: 'relay' }
    ]
  };
  const after = apply(state, { type: 'CAPTURE', assetId: 0, siteId: 's0' });
  assert.strictEqual(after.sites[0].team, -1);
});

test('1I captured site extends visibility radius', () => {
  const map = { width: 20, height: 20, cells: new Uint8Array(400), seed: 1 };
  const state = {
    tick: 0, map, operators: [{ id: 'op0', team: 0 }],
    assets: [
      { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE },
      { id: 1, team: 1, x: 1800, y: 0, status: ASSET_ACTIVE }
    ],
    sites: [
      { id: 's0', x: 0, y: 0, team: 0, type: 'relay' }
    ]
  };

  const view = buildView(state, 'op0');
  const enemy = view.assets.find(a => a.id === 1);
  assert.notStrictEqual(enemy, undefined, 'Enemy should be visible due to site fog extension');
});

test('1I neutral site does not extend visibility', () => {
  const map = { width: 20, height: 20, cells: new Uint8Array(400), seed: 1 };
  const state = {
    tick: 0, map, operators: [{ id: 'op0', team: 0 }],
    assets: [
      { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE },
      { id: 1, team: 1, x: 1800, y: 0, status: ASSET_ACTIVE }
    ],
    sites: [
      { id: 's0', x: 0, y: 0, team: -1, type: 'relay' }
    ]
  };

  const view = buildView(state, 'op0');
  const enemy = view.assets.find(a => a.id === 1);
  assert.strictEqual(enemy, undefined, 'Enemy should be hidden because site is neutral');
});
