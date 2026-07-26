// client/js/heading.js — gradual turning for the renderer (playtest 3 note:
// "units wiggled back and forth when they changed direction 90 degrees").
// Pure math: approach a target heading at a bounded angular rate along the
// shortest arc. Presentation only — the engine's axis-major movement is
// untouched; a true engine turn-rate model is a V2 item.

const TWO_PI = Math.PI * 2;

// Smallest signed angle from a to b, in (-PI, PI].
export function angleDelta(a, b) {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d <= -Math.PI) d += TWO_PI;
  return d;
}

// One smoothing step: turn current toward target, at most maxStep radians.
export function smoothHeading(current, target, maxStep) {
  if (target === null || target === undefined || Number.isNaN(target)) return current;
  const d = angleDelta(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

// Default turn rate: a full quarter turn takes ~0.35s at 60fps.
export const TURN_RATE_RAD_PER_SEC = 4.5;
