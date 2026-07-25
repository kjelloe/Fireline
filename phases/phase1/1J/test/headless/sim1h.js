// test/headless/sim1h.js — 1H Fog demo
import { buildView } from '../../engine/view.js';
import { ASSET_ACTIVE, ASSET_SUPPRESSED } from '../../engine/state.js';

const state = {
  tick: 0, map: { width: 10, height: 10, cells: new Uint8Array(100) }, sites: [],
  operators: [{ id: 'blue', team: 0 }],
  assets: [
    { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, type: 'SCOUT' },
    { id: 1, team: 1, x: 1000, y: 0, status: ASSET_ACTIVE, type: 'TANK' }
  ]
};

console.log('--- Fog Simulation (Team Blue) ---');
let view = buildView(state, 'blue');
console.log(`SCOUT active: Visible assets = ${view.assets.length} (Self + Tank)`);

state.assets[0].status = ASSET_SUPPRESSED;
view = buildView(state, 'blue');
console.log(`SCOUT suppressed: Visible assets = ${view.assets.length} (Self only - Tank is at dist 1000, radius is 768)`);
