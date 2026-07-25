// test/headless/sim1j.js — 1J Supply demo
import { apply } from '../../engine/reducer.js';
import { buildView } from '../../engine/view.js';
import { ASSET_ACTIVE } from '../../engine/state.js';

const map = { width: 10, height: 10, cells: new Uint8Array(100).fill(0), seed: 1 };
let state = {
  tick: 0, map, operators: [{ id: 'op0', team: 0 }],
  assets: [
    { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, hp: 100, speed: 100, targetX: 1000, targetY: 0, type: 'INF' }
  ],
  sites: []
};

console.log('--- Supply Simulation ---');
let view = buildView(state, 'op0');
console.log(`Tick ${state.tick}: Asset at (${state.assets[0].x}, ${state.assets[0].y}), inSupply=${view.assets[0].inSupply}`);

// 1 tick with no supply
state = apply(state, { type: 'tick' });
view = buildView(state, 'op0');
console.log(`Tick ${state.tick}: Asset at (${state.assets[0].x}, ${state.assets[0].y}), inSupply=${view.assets[0].inSupply}, HP=${state.assets[0].hp}`);

// Capture a relay to gain supply
state.sites.push({ id: 'relay_alpha', x: 0, y: 0, team: 0, type: 'relay' });
state = apply(state, { type: 'tick' });
view = buildView(state, 'op0');
console.log(`Tick ${state.tick}: Asset at (${state.assets[0].x}, ${state.assets[0].y}), inSupply=${view.assets[0].inSupply}, HP=${state.assets[0].hp}`);
