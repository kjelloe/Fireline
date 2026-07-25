// engine/mapgen.js — deterministic map generator

import { seedSfc32, sfc32Next } from '../shared/prng.js';

export const T_OPEN     = 0;
export const T_ROAD     = 1;
export const T_FOREST   = 2;
export const T_ROUGH    = 3;
export const T_BLOCKING = 4;

export function generateMap(seed, width, height) {
  const cells = new Uint8Array(width * height);
  let state = seedSfc32(seed);

  for (let i = 0; i < cells.length; i++) {
    const r = sfc32Next(state);
    state = r.nextState;
    const v = (r.value >>> 0) % 100;
    if (v < 70) cells[i] = T_OPEN;
    else if (v < 80) cells[i] = T_ROAD;
    else if (v < 90) cells[i] = T_FOREST;
    else if (v < 95) cells[i] = T_ROUGH;
    else cells[i] = T_BLOCKING;
  }

  return { width, height, cells, seed };
}

export function mapToString(map) {
  const chars = '.RFX#';
  let s = '';
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      s += chars[map.cells[y * map.width + x]] || '?';
    }
    s += '\n';
  }
  return s;
}
