// engine/supply.js — ammo/fuel supply rules (slice 1J).
// Firing costs ammo, moving costs fuel per tick, standing inside your team's
// home base zone restores both to maximum. Pure helpers; the reducer owns
// all mutation.

import { ASSET_IDLE } from "./state.js";
import { worldToCellFloor, absI32 } from "../shared/fixedmath.js";
import { KIND_DEPOT, DEPOT_RESUPPLY_CELLS } from "./sites.js";

export const AMMO_MAX = 12;
// 1 fuel per moving tick; at BASE_SPEED 32/256 cell a full 128-cell crossing
// costs ~1024 ticks. Slow chassis pay per TICK, so the laden Command Carrier
// (speed 24 x 192/256 carry multiplier) needs ~3200 for a standard round
// trip — sim seed 777 stranded it dry mid-map with the flag aboard. 4000
// keeps deep raids feasible until 11F brings fuel logistics; fuel still
// bites (a tank gets ~4 crossings, a laden carrier ~1.25 round trips).
export const FUEL_MAX = 4000;
export const SUPPLY_FIRE_COST = 1;
// 13A: a truck's field-resupply hold — exactly one asset's worth
// (FUEL_MAX went 2400->4000 in 11C; the hold tracks it).
export const CARGO_FUEL_MAX = 4000;
export const CARGO_AMMO_MAX = 12;
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
    if (s.owner !== asset.team || (s.hp ?? 1) <= 0) return false; // 11F
    const dx = Math.abs(s.cellX - cellX);
    const dy = Math.abs(s.cellY - cellY);
    return (dx > dy ? dx : dy) <= RELAY_SUPPLY_CELLS;
  });
}

// Returns {ammo, fuel} to restore if the asset qualifies for resupply and has
// a deficit, else null. Only idle assets resupply: transiting your base does
// not top you up (keeps advance_tick event streams quiet). Never mutates.
// B2 DEPOT: an owned depot site is a FORWARD resupply point — idling
// beside one (Chebyshev <= DEPOT_RESUPPLY_CELLS) counts like home.
export function resupplyAt(state, assetId) {
  const asset = state.assets[assetId];
  if (!asset) return null;
  if (asset.state !== ASSET_IDLE) return null;
  if (!inOwnBase(state, asset) && !atOwnDepot(state, asset)) return null;
  if (asset.ammo >= AMMO_MAX && asset.fuel >= FUEL_MAX) return null;
  return { ammo: AMMO_MAX, fuel: FUEL_MAX };
}

function atOwnDepot(state, asset) {
  const cx = worldToCellFloor(asset.x);
  const cy = worldToCellFloor(asset.y);
  return (state.sites ?? []).some((s) => {
    if (s.owner !== asset.team || s.kind !== KIND_DEPOT || (s.hp ?? 1) <= 0) return false;
    const dx = absI32(s.cellX - cx);
    const dy = absI32(s.cellY - cy);
    return (dx > dy ? dx : dy) <= DEPOT_RESUPPLY_CELLS;
  });
}
