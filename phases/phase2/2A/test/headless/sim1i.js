// test/headless/sim1i.js — 1I Relay Capture demo
import { apply } from '../../engine/reducer.js';
import { buildView } from '../../engine/view.js';
import { ASSET_ACTIVE } from '../../engine/state.js';

const map = { width: 10, height: 10, cells: new Uint8Array(100), seed: 1 };
let state = {
  tick: 0, map, operators: [{ id: 'op0', team: 0 }],
  assets: [
    { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, hp: 100, type: 'INF' },
    { id: 1, team: 1, x: 1800, y: 0, status: ASSET_ACTIVE, hp: 100, type: 'TANK' }
  ],
  sites: [
    { id: 'relay_alpha', x: 0, y: 0, team: -1, type: 'relay' }
  ]
};

console.log('--- Relay Capture Simulation ---');
let view = buildView(state, 'op0');
console.log(`Neutral relay: Visible enemies = ${view.assets.filter(a => a.team !== 0).length}`);

state = apply(state, { type: 'CAPTURE', assetId: 0, siteId: 'relay_alpha' });
view = buildView(state, 'op0');
console.log(`Captured relay: Visible enemies = ${view.assets.filter(a => a.team !== 0).length}`);
