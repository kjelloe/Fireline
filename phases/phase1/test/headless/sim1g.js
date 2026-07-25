// test/headless/sim1g.js — 1G Combat demo
import { apply } from '../../engine/reducer.js';
import { ASSET_ACTIVE, ASSET_DISABLED } from '../../engine/state.js';

const map = { width: 8, height: 8, cells: new Uint8Array(64), seed: 1 };
let s = {
  tick: 0, map, operators: [],
  assets: [
    { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, hp: 100, type: 'TANK' },
    { id: 1, team: 1, x: 512, y: 0, status: ASSET_ACTIVE, hp: 50, type: 'RADAR' }
  ]
};

console.log('--- Combat Simulation ---');
console.log(`Start: A0 (Team 0) vs A1 (Team 1, HP: ${s.assets[1].hp})`);

for (let i = 1; i <= 3; i++) {
  s = apply(s, { type: 'FIRE', assetId: 0, targetId: 1 });
  const target = s.assets[1];
  console.log(`Shot ${i}: Target HP is now ${target.hp}, Status: ${target.status === ASSET_DISABLED ? 'DISABLED' : 'ACTIVE'}`);
}
