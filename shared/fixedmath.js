// shared/fixedmath.js
// Integer fixed-point helpers. 1 logical cell = GRID_CELL_UNITS world units.
// No floats. All values are i32 unless noted.
// Restricted subset: no classes, no this, no null, plain functions only.

const GRID_CELL_UNITS = 256;

// Clamp a signed integer to [minValue, maxValue].
function clampI32(value, minValue, maxValue) {
  if (value < minValue) return minValue;
  if (value > maxValue) return maxValue;
  return value;
}

// Floor division for signed integers.
// JavaScript's / operator truncates toward zero; this floors toward -Infinity.
function floorDivI32(numerator, denominator) {
  if (denominator === 0) throw new RangeError("floorDivI32: division by zero");
  const q = Math.trunc(numerator / denominator);
  // Adjust if remainder is non-zero and signs differ
  const r = numerator - q * denominator;
  return (r !== 0 && (r < 0) !== (denominator < 0)) ? q - 1 : q;
}

// Convert a logical cell coordinate to world units.
function cellToWorld(cell) {
  if (!Number.isInteger(cell)) throw new RangeError("cellToWorld: non-integer cell");
  return cell * GRID_CELL_UNITS;
}

// Convert world units to logical cell (floor toward -Infinity).
function worldToCellFloor(worldUnits) {
  if (!Number.isInteger(worldUnits)) throw new RangeError("worldToCellFloor: non-integer");
  return floorDivI32(worldUnits, GRID_CELL_UNITS);
}

// Absolute value of a signed 32-bit integer.
// i32 minimum (-2147483648) has no positive i32 representation; return as-is.
function absI32(value) {
  return value < 0 ? (value === -2147483648 ? -2147483648 : -value) : value;
}

// Manhattan distance between two world-unit points.
function manhattanDistanceI32(ax, ay, bx, by) {
  return absI32(ax - bx) + absI32(ay - by);
}

export { GRID_CELL_UNITS, clampI32, floorDivI32, cellToWorld, worldToCellFloor, absI32, manhattanDistanceI32 };
