// engine/sites.js — relay sites: capture rules and constants (slice 1I).
// A relay is captured by an operable asset standing on its cell; an owned
// relay extends its team's fog coverage (see engine/los.js).

import { ASSET_DISABLED, ASSET_SALVAGED } from "./state.js";
import { worldToCellFloor } from "../shared/fixedmath.js";

export const SITE_RELAY = 1;
export const SITE_NEUTRAL = -1;

// B2 typed node classes (Q30 ruling): site KINDS. Every kind still
// counts as a relay for capture/majority/bleed — the personality is
// an EFFECT while held, so captures answer "what do we need?".
// Defaults are sweep-tested (ruling c), not sacred.
export const KIND_RELAY = 0;
export const KIND_RADAR = 1;   // owning team's sensors reach further
export const KIND_DEPOT = 2;   // forward resupply point (idle beside it)
export const KIND_FACTORY = 3; // rebuild waves arrive sooner
export const RADAR_BONUS_CELLS = 6;
export const DEPOT_RESUPPLY_CELLS = 4;
export const FACTORY_WAVE_DISCOUNT = 180; // 20% off a 900-tick wave

// An owned, operational site of this kind anywhere on the team's map?
export function teamHasKind(state, team, kind) {
  return state.sites.some((s) =>
    s.owner === team && s.kind === kind && (s.hp ?? 1) > 0);
}

// Fog radius contributed by an owned relay, in cells.
export const RELAY_FOG_CELLS = 16;

// 11B (prompt 16 Q3): Battlefield-2-inspired capture countdown, configurable.
// A lone team on a relay first drains it to NEUTRAL, then captures it.
export const SITE_NEUTRALIZE_TICKS = 30; // ~3 s enemy -> neutral
export const SITE_CAPTURE_TICKS = 30;    // ~3 s neutral -> yours

// 11F (Q9): sites are infrastructure with hit points. Two artillery
// shells (damage 30) knock a relay out; a DAMAGED site keeps its owner
// but projects nothing and cannot flip until a truck repairs it.
export const SITE_HP_MAX = 60;

export function siteOperational(site) {
  return (site.hp ?? SITE_HP_MAX) > 0;
}

// Returns the site the asset is standing on (or null). Pure; never mutates.
export function captureCheck(state, assetId) {
  const asset = state.assets[assetId];
  if (!asset) return null;
  if (asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED) return null;
  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  return state.sites.find((s) => s.cellX === cellX && s.cellY === cellY) ?? null;
}
