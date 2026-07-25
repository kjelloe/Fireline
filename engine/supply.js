// engine/supply.js — ammo/fuel supply rules (slice 1J).
// Firing costs ammo, moving costs fuel per tick, standing inside your team's
// home base zone restores both to maximum. Pure helpers; the reducer owns
// all mutation.

import { ASSET_IDLE } from "./state.js";
import { worldToCellFloor } from "../shared/fixedmath.js";

export const AMMO_MAX = 12;
export const FUEL_MAX = 600;
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
