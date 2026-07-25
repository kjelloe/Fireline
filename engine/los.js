// engine/los.js — line-of-sight / fog visibility (slice 1H).
// Pure helpers deciding which enemy assets a team can see. Chebyshev cell
// distance; suppressed sensors see half as far; disabled/salvaged wrecks are
// battlefield features and stay visible regardless of fog.

import { ASSET_DISABLED, ASSET_SALVAGED, isSuppressed } from "./state.js";
import { RELAY_FOG_CELLS } from "./sites.js";
import { worldToCellFloor, absI32 } from "../shared/fixedmath.js";

export const FOG_RADIUS_CELLS = 12;
export const SUPPRESSED_RADIUS_CELLS = 6;

export function sensorRadius(asset) {
  return isSuppressed(asset) ? SUPPRESSED_RADIUS_CELLS : FOG_RADIUS_CELLS;
}

function chebyshevCells(a, b) {
  const dx = absI32(worldToCellFloor(a.x) - worldToCellFloor(b.x));
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
  const siteSensors = state.sites.filter((s) => s.owner === team);
  const visible = new Set();
  for (const asset of state.assets) {
    if (asset.team === team || asset.team === -1) continue;
    if (isWreck(asset)) {
      visible.add(asset.id);
      continue;
    }
    const assetCellX = worldToCellFloor(asset.x);
    const assetCellY = worldToCellFloor(asset.y);
    const seen =
      sensors.some((s) => chebyshevCells(s, asset) <= sensorRadius(s)) ||
      siteSensors.some((s) => {
        const dx = absI32(s.cellX - assetCellX);
        const dy = absI32(s.cellY - assetCellY);
        return (dx > dy ? dx : dy) <= RELAY_FOG_CELLS;
      });
    if (seen) visible.add(asset.id);
  }
  return visible;
}
