// engine/los.js — line-of-sight / fog visibility (slice 1H).
// Pure helpers deciding which enemy assets a team can see. Chebyshev cell
// distance; suppressed sensors see half as far; disabled/salvaged wrecks are
// battlefield features and stay visible regardless of fog.

import { ASSET_DISABLED, ASSET_SALVAGED, isSuppressed } from "./state.js";
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

// Returns Set<assetId> of enemy assets visible to `team`.
export function computeVisible(state, team) {
  const sensors = state.assets.filter((a) => a.team === team && !isWreck(a));
  const visible = new Set();
  for (const asset of state.assets) {
    if (asset.team === team || asset.team === -1) continue;
    if (isWreck(asset)) {
      visible.add(asset.id);
      continue;
    }
    if (sensors.some((s) => chebyshevCells(s, asset) <= sensorRadius(s))) {
      visible.add(asset.id);
    }
  }
  return visible;
}
