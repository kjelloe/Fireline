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

// Prompt 222 (the residual wiggle): grid-stepped travel flaps the ORDERED
// heading ±1 sector (22.5°) tick after tick, and a rate cap alone chases
// every flip — the hull visibly wobbles. The STABILITY GATE decides which
// target the smoother is even allowed to see:
//   - a REAL turn (>= ADOPT_BAND_RAD, between one and two sectors) is
//     adopted instantly — turns stay snappy, no mushy tail;
//   - a small change is adopted only after persisting HOLD_FRAMES —
//     a flap never persists, so it freezes out completely.
// Slow genuine curves still track: a drifting candidate (within
// CAND_TOL_RAD frame-to-frame) counts as persisting.
export const ADOPT_BAND_RAD = 0.48;
const CAND_TOL_RAD = 0.08;
const HOLD_FRAMES = 12; // ~two 10 Hz ticks at 60 fps
export function adoptTarget(state, raw) {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return state;
  if (!state || state.adopted === undefined) return { adopted: raw, cand: null, held: 0 };
  const fromAdopted = Math.abs(angleDelta(state.adopted, raw));
  if (fromAdopted < 1e-9) return { adopted: state.adopted, cand: null, held: 0 };
  if (fromAdopted >= ADOPT_BAND_RAD) return { adopted: raw, cand: null, held: 0 };
  if (state.cand !== null && Math.abs(angleDelta(state.cand, raw)) < CAND_TOL_RAD) {
    const held = state.held + 1;
    if (held >= HOLD_FRAMES) return { adopted: raw, cand: null, held: 0 };
    return { adopted: state.adopted, cand: raw, held };
  }
  return { adopted: state.adopted, cand: raw, held: 1 };
}

// Default turn rate: a full quarter turn takes ~0.35s at 60fps.
export const TURN_RATE_RAD_PER_SEC = 4.5;
