// client/js/splash_model.js — the splash state controller (designer
// brief: specs/splash-screen-setup*.md, recommended concept 1+2 "The
// Front Ignites" with a boot overlay). PURE state machine so the rules
// the brief cares about are node-testable:
//
// - The splash is tied to REAL loading milestones, never faked.
// - Skip (click/Enter/Space/Escape) works once core assets are ready;
//   before that it only accelerates to the title hold + shows
//   "Preparing the front…".
// - Returning players (seenBefore) get the short 1.5s version.
// - prefers-reduced-motion collapses animation to a static title card.
//
// The DOM side (client.js) renders phases; this decides them.

export const PHASE_ANIM = 0;   // grid -> front line -> pips -> title
export const PHASE_HOLD = 1;   // title held (assets still loading)
export const PHASE_DONE = 2;   // faded out, node removed

export const FULL_MS = 4500;   // first visit, cold load
export const SHORT_MS = 1500;  // returning player

export function createSplash({ seenBefore = false, reducedMotion = false } = {}) {
  const s = {
    phase: PHASE_ANIM,
    ready: false,          // "all assets ready" milestone (first view)
    skipWanted: false,
    minMs: reducedMotion ? 800 : seenBefore ? SHORT_MS : FULL_MS,
    reducedMotion,
    preparing: false,      // show "Preparing the front…"
  };
  return {
    state: s,
    assetsReady() {
      s.ready = true;
      if (s.phase === PHASE_HOLD || s.skipWanted) s.phase = PHASE_DONE;
    },
    skip() {
      s.skipWanted = true;
      if (s.ready) {
        s.phase = PHASE_DONE;      // ready: skip goes straight out
      } else {
        s.phase = PHASE_HOLD;      // not ready: accelerate to title hold
        s.preparing = true;        // and be honest about why we wait
      }
    },
    timeUp() {                      // the minimum duration elapsed
      if (s.phase === PHASE_DONE) return;
      s.phase = s.ready ? PHASE_DONE : PHASE_HOLD;
      s.preparing = !s.ready;
    },
    done() { return s.phase === PHASE_DONE; },
  };
}
