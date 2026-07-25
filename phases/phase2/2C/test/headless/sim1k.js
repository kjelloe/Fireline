// test/headless/sim1k.js — 1K Replay demo
import { apply, createInitialState } from '../../engine/reducer.js';
import { replay } from '../../engine/replay.js';
import { ASSET_ACTIVE } from '../../engine/state.js';

const map = { width: 8, height: 8, cells: new Uint8Array(64), seed: 1 };
const initial = createInitialState(1, map);
initial.assets = [
  { id: 0, team: 0, x: 0, y: 0, status: ASSET_ACTIVE, hp: 100, speed: 100, targetX: 1000, targetY: 0, type: 'INF' }
];
initial.sites = [
  { id: 's0', x: 0, y: 0, team: 0, type: 'relay' }
];

let state = initial;
for (let i = 0; i < 10; i++) {
  state = apply(state, { type: 'tick' });
}

console.log('--- Replay Simulation ---');
console.log(`Original final tick: ${state.tick}`);
console.log(`Original final asset X: ${state.assets[0].x}`);
console.log(`Command log length: ${state.commands.length}`);

const replayed = replay(initial, state.commands);
console.log(`Replayed final tick: ${replayed.tick}`);
console.log(`Replayed final asset X: ${replayed.assets[0].x}`);
console.log(`Deterministic match: ${state.tick === replayed.tick && state.assets[0].x === replayed.assets[0].x}`);
