// client/js/touch_model.js — Slice 15A: mobile touch (ruling Q10). Pure
// math, headless-tested. The on-screen arrow pad points the tank at a
// compass heading and sets it off; this controller converts (current
// heading, desired heading) into the engine's drive intent every frame.
// Tap classification and pinch zoom live here too — the client file only
// wires events.

// Shortest signed arc a→b in brads (-128, 128].
export function bradDelta(a, b) {
  let d = (b - a) & 255;
  if (d > 128) d -= 256;
  return d;
}

// The arrow-pad controller: full throttle toward the desired heading,
// steering at the chassis' own rate via the drive intent. Deadband keeps
// the tail from wagging once aligned.
export function arrowDrive(currentBrads, desiredBrads, deadband = 8) {
  const d = bradDelta(currentBrads, desiredBrads);
  return {
    throttle: 1,
    turn: Math.abs(d) <= deadband ? 0 : d > 0 ? 1 : -1,
  };
}

// Arrow pad directions → engine brads (0 = east, 64 = south/screen-down).
export const ARROW_BRADS = Object.freeze({
  n: 192, ne: 224, e: 0, se: 32, s: 64, sw: 96, w: 128, nw: 160,
});

// Tap, hold, or drag? Near where it began and quick = tap (an order);
// near where it began but HELD = "hold" (prompt 214: the touch
// equivalent of SHIFT-click — queues a waypoint leg; there is no SHIFT
// on a phone); anything that moved pans the camera.
export function classifyTouch(start, end, dtMs, { maxDist = 14, maxMs = 400, holdMs = 700 } = {}) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx * dx + dy * dy <= maxDist * maxDist) {
    if (dtMs <= maxMs) return "tap";
    if (dtMs >= holdMs) return "hold";
  }
  return "drag";
}

// Two-finger pinch: distance ratio → zoom factor, clamped sane.
export function pinchFactor(d0, d1) {
  if (d0 <= 0 || d1 <= 0) return 1;
  const f = d0 / d1;
  return Math.max(0.5, Math.min(2, f));
}

// True on devices where the touch overlay should exist at all.
export function isTouchDevice(nav = globalThis.navigator, win = globalThis.window) {
  return !!(win && ("ontouchstart" in win || (nav?.maxTouchPoints ?? 0) > 0));
}
