// shared/fixedmath.js — 256-unit fixed-point helpers

export function clampI32(v, min, max) {
  if (v < min) return min | 0;
  if (v > max) return max | 0;
  return v | 0;
}

export function toFixed(v) {
  return Math.round(v * 256) | 0;
}

export function fromFixed(v) {
  return v / 256;
}

export function mulFixed(a, b) {
  return ((a * b) / 256) | 0;
}

export function divFixed(a, b) {
  return ((a * 256) / b) | 0;
}
