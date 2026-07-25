// engine/terrain.js — terrain speed multipliers (1F)

import { T_OPEN, T_ROAD, T_FOREST, T_ROUGH, T_BLOCKING } from './mapgen.js';

// Multipliers as fixed-point integers (1.0 = 256)
export const TERRAIN_SPEED = Object.freeze({
  [T_OPEN]:     256,
  [T_ROAD]:     358,   // ~1.4x
  [T_FOREST]:   179,   // ~0.7x
  [T_ROUGH]:    128,   // 0.5x
  [T_BLOCKING]:   0,   // 0.0x
});

export function speedMultiplier(terrainId) {
  return TERRAIN_SPEED[terrainId] ?? 256;
}
