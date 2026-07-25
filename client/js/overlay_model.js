// client/js/overlay_model.js — tactical overlay geometry (slice 4A).
// Pure view-derived data for the renderer: supply rings, weapon range ring,
// health-bar fractions. Reads engine stat tables as data only — no outcomes
// are computed client-side.

import { getUnitStats } from "../../engine/units.js";
import { SUPPLY_RADIUS_CELLS, RELAY_SUPPLY_CELLS } from "../../engine/supply.js";

const CELL = 256;

// Rings in cell units for the viewer's team: base rects + owned relays.
export function supplyOverlays(view) {
  const overlays = [];
  for (const base of view.bases ?? []) {
    if (base.team !== view.team) continue;
    overlays.push({
      kind: "base",
      centerX: base.x + base.width / 2,
      centerY: base.y + base.height / 2,
      radiusCells: SUPPLY_RADIUS_CELLS + Math.max(base.width, base.height) / 2,
    });
  }
  for (const site of view.sites ?? []) {
    if (site.owner !== view.team) continue;
    overlays.push({
      kind: "relay",
      centerX: site.cellX + 0.5,
      centerY: site.cellY + 0.5,
      radiusCells: RELAY_SUPPLY_CELLS,
    });
  }
  return overlays;
}

// Weapon range ring (and min-range hole) for the asset an operator drives.
export function weaponRangeOverlay(view, operatorId) {
  const own = (view.friendlyAssets ?? []).find((a) => a.operatorId === operatorId);
  if (!own || own.state === 2 || own.state === 3) return null;
  const stats = getUnitStats(own.type);
  return {
    centerX: own.x / CELL + 0.5,
    centerY: own.y / CELL + 0.5,
    radiusCells: stats.range / CELL,
    minRadiusCells: stats.minRange / CELL,
  };
}

// 0..1 health fraction against the chassis maximum.
export function healthFraction(asset) {
  const max = getUnitStats(asset.type).hp;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, asset.hp / max));
}

export function healthBars(view) {
  const bars = [];
  for (const a of view.friendlyAssets ?? []) {
    bars.push({ id: a.id, x: a.x / CELL + 0.5, y: a.y / CELL + 0.5, fraction: healthFraction(a), friendly: true });
  }
  for (const e of view.visibleEnemies ?? []) {
    if (e.state === 2 || e.state === 3) continue; // wrecks carry no bar
    bars.push({ id: e.id, x: e.x / CELL + 0.5, y: e.y / CELL + 0.5, fraction: null, friendly: false });
  }
  return bars;
}
