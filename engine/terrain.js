// engine/terrain.js — terrain speed multipliers (1F; 11N per-chassis paths)

import { T_OPEN, T_ROAD, T_FOREST, T_ROUGH, T_BLOCKING, T_PATH } from './mapgen.js';

// Multipliers as fixed-point integers (1.0 = 256)
export const TERRAIN_SPEED = Object.freeze({
  [T_OPEN]:     256,
  [T_ROAD]:     358,   // ~1.4x
  [T_FOREST]:   179,   // ~0.7x
  [T_ROUGH]:    128,   // 0.5x
  [T_BLOCKING]:   0,   // 0.0x
  [T_PATH]:     307,   // ~1.2x — trails beat open ground but not the road
});
// 11N (Q22): a HEAVY chassis gains nothing from narrow trails — it crosses
// them at rough speed. First per-chassis terrain rule; keep it explicit.
export const PATH_SPEED_HEAVY = 128;

export function speedMultiplier(terrainId, stats = null) {
  if (terrainId === T_PATH && stats?.heavy) return PATH_SPEED_HEAVY;
  return TERRAIN_SPEED[terrainId] ?? 256;
}
