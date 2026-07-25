// engine/recovery.js — wreck tow-back rescue (slice 8D).
// No menu respawns: a disabled asset stays on the field as a wreck until a
// friendly asset tows it home. Recovery takes deterministic ticks and the
// asset returns to service at half hull. Pure helpers; reducer mutates.

import { ASSET_DISABLED, ASSET_SALVAGED } from "./state.js";
import { getUnitStats } from "./units.js";
import { worldToCellFloor, absI32, floorDivI32 } from "../shared/fixedmath.js";

// Towing halves the tower's speed (stacks with supply/carrier penalties).
export const TOW_SPEED_NUM = 128;
export const TOW_SPEED_DEN = 256;

// Repair bay time once the wreck reaches its own base, and the hull fraction
// it returns with.
export const REPAIR_TICKS = 100;

export function restoredHp(type) {
  return floorDivI32(getUnitStats(type).hp, 2);
}

export function isWreck(asset) {
  return asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED;
}

// The wreck this asset is currently towing, if any.
export function towedWreck(state, towerId) {
  return state.assets.find((a) => a.towedBy === towerId) ?? null;
}

function adjacentCells(a, b) {
  const dx = absI32(worldToCellFloor(a.x) - worldToCellFloor(b.x));
  const dy = absI32(worldToCellFloor(a.y) - worldToCellFloor(b.y));
  return (dx > dy ? dx : dy) <= 1;
}

// Why a tow cannot start, or null when it can.
export function towRejection(state, tower, wreck) {
  if (!wreck) return "no such wreck";
  if (!isWreck(wreck)) return "not a wreck";
  if (wreck.team !== tower.team) return "enemy wreck";
  if (wreck.towedBy !== -1) return "already under tow";
  if (wreck.recoverTimer > 0) return "already recovering";
  if (towedWreck(state, tower.id)) return "already towing";
  if (!adjacentCells(tower, wreck)) return "wreck out of reach";
  return null;
}
