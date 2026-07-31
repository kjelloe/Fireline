// engine/los.js — line-of-sight / fog visibility (slice 1H).
// Pure helpers deciding which enemy assets a team can see. Chebyshev cell
// distance; suppressed sensors see half as far; disabled/salvaged wrecks are
// battlefield features and stay visible regardless of fog.

import { ASSET_DISABLED, ASSET_SALVAGED, isSuppressed } from "./state.js";
import { sampleCellX } from "../shared/fixedmath.js";
import { RELAY_FOG_CELLS, KIND_RADAR, RADAR_BONUS_CELLS } from "./sites.js";
import { worldToCellFloor, absI32 } from "../shared/fixedmath.js";

export const FOG_RADIUS_CELLS = 12;
export const SUPPRESSED_RADIUS_CELLS = 6;

export function sensorRadius(asset) {
  return isSuppressed(asset) ? SUPPRESSED_RADIUS_CELLS : FOG_RADIUS_CELLS;
}

// 16G weather events (gameplay-evolved #4b, ruled): once per war a
// deterministic FRONT rolls in — sensors halve for its duration. The
// schedule is a PURE function of the map seed (no new hashed state, no
// repin, replays honest by construction): start in the mid-war band
// [6000, 12000), duration 900 ticks (90 s). Both teams equally blinded —
// scouts, pings, and standard runs own the storm.
export const WEATHER_DURATION_TICKS = 900;
export function weatherWindow(mapSeed) {
  // mix32-style scramble inline (shared/prng mix32 is engine-importable
  // but keep los.js dependency-light): deterministic, integer.
  let h = (mapSeed >>> 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  const start = 6000 + (h % 6000);
  return { start, end: start + WEATHER_DURATION_TICKS };
}
export function weatherActive(state) {
  const w = weatherWindow(state.mapSeed);
  return state.tick >= w.start && state.tick < w.end;
}

export function chebyshevCells(a, b) {
  const dx = absI32(sampleCellX(a.x) - sampleCellX(b.x));
  const dy = absI32(worldToCellFloor(a.y) - worldToCellFloor(b.y));
  return dx > dy ? dx : dy;
}

function isWreck(asset) {
  return asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED;
}

// Returns Set<assetId> of enemy assets visible to `team`. Sensors are the
// team's non-wreck assets plus any relay sites the team owns (1I).
export function computeVisible(state, team) {
  const sensors = state.assets.filter((a) => a.team === team && !isWreck(a));
  const siteSensors = state.sites.filter((s) => s.owner === team && (s.hp ?? 1) > 0); // 11F
  const visible = new Set();
  for (const asset of state.assets) {
    if (asset.team === team || asset.team === -1) continue;
    if (isWreck(asset)) {
      visible.add(asset.id);
      continue;
    }
    const assetCellX = sampleCellX(asset.x);
    const assetCellY = worldToCellFloor(asset.y);
    const storm = weatherActive(state); // 16G: the front halves every sensor
    // B2 RADAR: an owned radar site widens every unit sensor on the
    // team. Applied AFTER the storm halving — radar cuts through
    // weather, which is exactly when holding it should matter most.
    const radarBonus = state.sites.some((s) =>
      s.owner === team && s.kind === KIND_RADAR && (s.hp ?? 1) > 0)
      ? RADAR_BONUS_CELLS : 0;
    const seen =
      sensors.some((s) => chebyshevCells(s, asset) <= (storm ? sensorRadius(s) >> 1 : sensorRadius(s)) + radarBonus) ||
      siteSensors.some((s) => {
        const dx = absI32(s.cellX - assetCellX);
        const dy = absI32(s.cellY - assetCellY);
        return (dx > dy ? dx : dy) <= (storm ? RELAY_FOG_CELLS >> 1 : RELAY_FOG_CELLS);
      });
    if (seen) visible.add(asset.id);
  }
  return visible;
}
