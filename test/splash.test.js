// test/splash.test.js — the splash controller (designer brief rules:
// tied to REAL loading, skip only exits when ready, returning players
// get the short version, reduced motion collapses to a title card).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSplash, PHASE_ANIM, PHASE_HOLD, PHASE_DONE, FULL_MS, SHORT_MS,
} from "../client/js/splash_model.js";

test("splash: skip before assets are ready HOLDS honestly, never fakes done", () => {
  const c = createSplash();
  c.skip();
  assert.equal(c.state.phase, PHASE_HOLD, "accelerated to the title hold");
  assert.equal(c.state.preparing, true, "and says why it waits");
  assert.ok(!c.done());
  c.assetsReady();
  assert.ok(c.done(), "the pending skip releases the moment loading finishes");
});

test("splash: skip after ready exits immediately", () => {
  const c = createSplash();
  c.assetsReady();
  assert.equal(c.state.phase, PHASE_ANIM, "ready alone does not cut the animation");
  c.skip();
  assert.ok(c.done());
});

test("splash: the timer alone finishes only when loading has finished", () => {
  const slow = createSplash();
  slow.timeUp();
  assert.equal(slow.state.phase, PHASE_HOLD, "slow connection holds on the title");
  assert.equal(slow.state.preparing, true);
  slow.assetsReady();
  assert.ok(slow.done());

  const fast = createSplash();
  fast.assetsReady();
  fast.timeUp();
  assert.ok(fast.done(), "ready + time up = out");
});

test("splash: returning players and reduced motion get the short forms", () => {
  assert.equal(createSplash().state.minMs, FULL_MS);
  assert.equal(createSplash({ seenBefore: true }).state.minMs, SHORT_MS);
  const rm = createSplash({ reducedMotion: true, seenBefore: false });
  assert.ok(rm.state.minMs < SHORT_MS, "reduced motion is the shortest");
  assert.equal(rm.state.reducedMotion, true);
});
