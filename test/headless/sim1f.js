// test/headless/sim1f.js — 1F headless terrain speed demo

import { generateMap } from '../../engine/mapgen.js';
import { apply, createInitialState } from '../../engine/reducer.js';
import { mapToString } from '../../engine/mapgen.js';
import { speedMultiplier } from '../../engine/terrain.js';

const map = generateMap(12345, 8, 8);
const state = createInitialState(12345, map);

state.assets = [
  { id: 0, team: 0, x: 0, y: 0, speed: 16, status: 0, targetX: 2048, targetY: 0 },
];

console.log('Map:');
console.log(mapToString(map));
console.log('Terrain speed multipliers: road=1.4x open=1.0x forest=0.7x rough=0.5x blocking=0.0x');
console.log('');
console.log('Tick  Asset  Cell  Terrain  Speed  X');

let s = state;
for (let t = 0; t <= 10; t++) {
  const asset = s.assets[0];
  const cx = Math.floor(asset.x / 256);
  const cy = Math.floor(asset.y / 256);
  const cellIdx = cy * map.width + cx;
  const terrain = map.cells[cellIdx];
  const mult = speedMultiplier(terrain);
  console.log(`${String(t).padStart(4)}  A0     (${cx},${cy})  ${String(terrain).padStart(2)}      ${String(mult).padStart(3)}  ${asset.x}`);
  s = apply(s, { type: 'tick' });
}
