// engine/supply.js — ammo/fuel supply rules (slice 1J).
// Firing costs ammo, moving costs fuel per tick, standing inside your team's
// home base zone restores both to maximum. Pure helpers; the reducer owns
// all mutation.

import { ASSET_IDLE } from "./state.js";
import { worldToCellFloor } from "../shared/fixedmath.js";

export const AMMO_MAX = 12;
// 1 fuel per moving tick; 2400 covers a full 128-cell map crossing (~2048
// ticks at BASE_SPEED 16/256 cell) with margin. Tuned for 2A integration.
export const FUEL_MAX = 2400;
export const SUPPLY_FIRE_COST = 1;
export const SUPPLY_MOVE_COST = 1;

export function inOwnBase(state, asset) {
  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  return state.bases.some(
    (b) => b.team === asset.team &&
      cellX >= b.x && cellX < b.x + b.width &&
      cellY >= b.y && cellY < b.y + b.height
  );
}

// ── supply projection (slice 3B) ─────────────────────────────────────────────
// Bases and owned relay sites project supply in a radius. Out-of-supply units
// move at half speed and cannot fire — capturing relays is how a team pushes
// its operational reach across the map.

export const SUPPLY_RADIUS_CELLS = 20;
export const RELAY_SUPPLY_CELLS = 12;

function chebyshevToRect(cellX, cellY, rect) {
  const dx = Math.max(rect.x - cellX, 0, cellX - (rect.x + rect.width - 1));
  const dy = Math.max(rect.y - cellY, 0, cellY - (rect.y + rect.height - 1));
  return dx > dy ? dx : dy;
}

export function inSupply(state, asset) {
  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  const baseCovered = state.bases.some(
    (b) => b.team === asset.team && chebyshevToRect(cellX, cellY, b) <= SUPPLY_RADIUS_CELLS
  );
  if (baseCovered) return true;
  return state.sites.some((s) => {
    if (s.owner !== asset.team) return false;
    const dx = Math.abs(s.cellX - cellX);
    const dy = Math.abs(s.cellY - cellY);
    return (dx > dy ? dx : dy) <= RELAY_SUPPLY_CELLS;
  });
}

// Returns {ammo, fuel} to restore if the asset qualifies for resupply and has
// a deficit, else null. Only idle assets resupply: transiting your base does
// not top you up (keeps advance_tick event streams quiet). Never mutates.
export function resupplyAt(state, assetId) {
  const asset = state.assets[assetId];
  if (!asset) return null;
  if (asset.state !== ASSET_IDLE) return null;
  if (!inOwnBase(state, asset)) return null;
  if (asset.ammo >= AMMO_MAX && asset.fuel >= FUEL_MAX) return null;
  return { ammo: AMMO_MAX, fuel: FUEL_MAX };
}
