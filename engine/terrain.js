// engine/terrain.js — terrain speed multipliers (1F; 11N per-chassis paths)

import { T_OPEN, T_ROAD, T_FOREST, T_ROUGH, T_BLOCKING, T_PATH, T_WATER } from './mapgen.js';

// Multipliers as fixed-point integers (1.0 = 256)
export const TERRAIN_SPEED = Object.freeze({
  [T_OPEN]:     256,
  [T_ROAD]:     358,   // ~1.4x
  [T_FOREST]:   179,   // ~0.7x
  [T_ROUGH]:    128,   // 0.5x
  [T_BLOCKING]:   0,   // 0.0x
  [T_PATH]:     307,   // ~1.2x — trails beat open ground but not the road
  [T_WATER]:     64,   // 0.25x — fording is misery (12C); Skimmers fly it
});
// 12C (Riverline Drive): the amphibious chassis treats water as a trail.
export const WATER_SPEED_AMPHIBIOUS = 307;
// Prompt-54 (designer stat ruling): Riverline Drive extends to NEGLECTED
// ROUTES — trails are the Skimmer's highway at road-grade speed. This is
// the Outlier unique's job on every map (the lateral-relay racer), and
// the stat-side answer to the Sentinel-side 60% swap-gate verdict.
export const PATH_SPEED_AMPHIBIOUS = 416; // prompt-56 band tightening (384 at first landing)
// 11N (Q22): a HEAVY chassis gains nothing from narrow trails — it crosses
// them at rough speed. First per-chassis terrain rule; keep it explicit.
export const PATH_SPEED_HEAVY = 128;

export function speedMultiplier(terrainId, stats = null) {
  if (terrainId === T_PATH && stats?.amphibious) return PATH_SPEED_AMPHIBIOUS; // prompt-54
  if (terrainId === T_PATH && stats?.heavy) return PATH_SPEED_HEAVY;
  if (terrainId === T_WATER && stats?.amphibious) return WATER_SPEED_AMPHIBIOUS; // 12C
  return TERRAIN_SPEED[terrainId] ?? 256;
}
