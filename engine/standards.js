// engine/standards.js — Command Standards: the core objective (slices 8A/8B).
// Each team owns one physical standard. Steal the enemy's, carry it through
// contested ground into your own command zone while yours sits safe at home —
// that scores the war. Pure helpers only; the reducer owns all mutation.

import { ASSET_DISABLED, ASSET_SALVAGED } from "./state.js";
import { getUnitStats } from "./units.js";
import { worldToCellFloor, cellToWorld } from "../shared/fixedmath.js";

export const STD_AT_BASE = 0;
export const STD_CARRIED = 1;
export const STD_DROPPED = 2;
export const STD_SCORED = 3;

// Carrying the prize slows you down: 192/256 = 0.75x speed.
export const CARRIER_SPEED_NUM = 192;
export const CARRIER_SPEED_DEN = 256;

// Anti-deadlock (ruling Q2): a standard left DROPPED this long walks home by
// itself. 600 ticks = 60 s.
export const AUTO_RETURN_TICKS = 600;

// Home positions inside each command zone (off the road grid, mirrored).
export const STANDARD_HOMES = Object.freeze([
  Object.freeze({ cellX: 14, cellY: 59 }),
  Object.freeze({ cellX: 113, cellY: 59 }),
]);

export function createStandards(homes = STANDARD_HOMES) {
  return (homes ?? STANDARD_HOMES).map((home, team) => ({
    id: team,
    team,
    x: cellToWorld(home.cellX),
    y: cellToWorld(home.cellY),
    homeCellX: home.cellX,
    homeCellY: home.cellY,
    carrierAssetId: -1,
    status: STD_AT_BASE,
    droppedTimer: 0,
  }));
}

function isWreck(asset) {
  return asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED;
}

export function assetCarries(state, assetId) {
  return state.standards.find(
    (s) => s.status === STD_CARRIED && s.carrierAssetId === assetId
  ) ?? null;
}

// The standard (if any) lying on the asset's cell that this asset may pick up:
// only the ENEMY standard, only when grounded, and ONLY by a Command Carrier
// (ruling: carrying is Carrier-exclusive as of 9A).
export function standardTakeableBy(state, asset) {
  if (isWreck(asset)) return null;
  if (!getUnitStats(asset.type).canCarryStandard) return null;
  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  return state.standards.find(
    (s) => s.team !== asset.team &&
      (s.status === STD_AT_BASE || s.status === STD_DROPPED) &&
      worldToCellFloor(s.x) === cellX && worldToCellFloor(s.y) === cellY
  ) ?? null;
}

// The team's OWN dropped standard on the asset's cell (touch returns it home).
export function standardReturnableBy(state, asset) {
  if (isWreck(asset)) return null;
  const cellX = worldToCellFloor(asset.x);
  const cellY = worldToCellFloor(asset.y);
  return state.standards.find(
    (s) => s.team === asset.team && s.status === STD_DROPPED &&
      worldToCellFloor(s.x) === cellX && worldToCellFloor(s.y) === cellY
  ) ?? null;
}

// Scoring gate: carrier inside own command zone AND own standard AT_BASE.
export function canScore(state, carrierAsset) {
  const own = state.standards.find((s) => s.team === carrierAsset.team);
  if (!own || own.status !== STD_AT_BASE) return false;
  const cellX = worldToCellFloor(carrierAsset.x);
  const cellY = worldToCellFloor(carrierAsset.y);
  return state.bases.some(
    (b) => b.team === carrierAsset.team &&
      cellX >= b.x && cellX < b.x + b.width &&
      cellY >= b.y && cellY < b.y + b.height
  );
}
