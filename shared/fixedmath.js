// shared/fixedmath.js — integer / 256-unit fixed-point helpers.
// Reconstructed for the 1E contract from test/fixtures/0E (milestone 0).
// One cell = 256 fixed world units. All functions are pure integer math.

export const CELL_SIZE = 256;

export function clampI32(v, min, max) {
  if (v < min) return min | 0;
  if (v > max) return max | 0;
  return v | 0;
}

export function floorDivI32(a, b) {
  return Math.floor(a / b) | 0;
}

// Signed division rounded TOWARD ZERO — for quantities where negative
// and positive must shrink by the same magnitude. floorDivI32 on a
// signed product rounds -inf-ward, which made westward/northward
// movement steps up to a unit longer than their mirrors (the riverline
// east-edge root cause, 2026-07-27).
export function truncDivI32(a, b) {
  return Math.trunc(a / b) | 0;
}

export function absI32(v) {
  return v < 0 ? (-v | 0) : (v | 0);
}

export function cellToWorld(cell) {
  return (cell * CELL_SIZE) | 0;
}

export function worldToCellFloor(world) {
  return floorDivI32(world, CELL_SIZE);
}

export function manhattanDistanceI32(x0, y0, x1, y1) {
  return (absI32(x1 - x0) + absI32(y1 - y0)) | 0;
}

export function mulFixed(a, b) {
  return floorDivI32(a * b, CELL_SIZE);
}

export function divFixed(a, b) {
  return floorDivI32(a * CELL_SIZE, b);
}
