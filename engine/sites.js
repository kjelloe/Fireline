// engine/sites.js — relay sites: capture rules and constants (slice 1I).
// A relay is captured by an operable asset standing on its cell; an owned
// relay extends its team's fog coverage (see engine/los.js).

import { ASSET_DISABLED, ASSET_SALVAGED } from "./state.js";
import { worldToCellFloor } from "../shared/fixedmath.js";

export const SITE_RELAY = 1;
export const SITE_NEUTRAL = -1;

// Fog radius contributed by an owned relay, in cells.
export const RELAY_FOG_CELLS = 16;

// 11B (prompt 16 Q3): Battlefield-2-inspired capture countdown, configurable.
// A lone team on a relay first drains it to NEUTRAL, then captures it.
export const SITE_NEUTRALIZE_TICKS = 30; // ~3 s enemy -> neutral
export const SITE_CAPTURE_TICKS = 30;    // ~3 s neutral -> yours

// Returns the site the asset is standing on (or null). Pure; never mutates.
export function captureCheck(state, assetId) {
  const asset = state.assets[assetId];
  if (!asset) return null;
  if (asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED) return null;
  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  return state.sites.find((s) => s.cellX === cellX && s.cellY === cellY) ?? null;
}
