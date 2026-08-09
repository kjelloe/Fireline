// test/heading_model.test.js — prompt 222: the residual wiggle.
// Grid-stepped travel flaps the engine's ordered heading ±1 sector
// (22.5°) tick after tick; a rate cap alone chases every flip and the
// hull visibly wobbles. The STABILITY GATE (adoptTarget) freezes flaps
// out entirely — a small change must persist to be adopted — while
// real turns adopt instantly and keep the full turn rate.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  smoothHeading, angleDelta, adoptTarget, ADOPT_BAND_RAD, TURN_RATE_RAD_PER_SEC,
} from "../client/js/heading.js";

const STEP = TURN_RATE_RAD_PER_SEC / 60; // the renderer's per-frame cap
const SECTOR = (Math.PI * 2) / 16;       // one 16-dir sector = 22.5°

function drive(targets) {
  let gate; let h = 0;
  const seen = [];
  for (const raw of targets) {
    gate = adoptTarget(gate, raw);
    h = smoothHeading(h, gate.adopted, STEP);
    seen.push(h);
  }
  return { h, seen, gate };
}

test("sector flapping freezes out completely", () => {
  // The engine alternates between two adjacent sector headings every
  // 6 frames (one 10 Hz tick at 60 fps) — the reported wiggle.
  const targets = [];
  for (let frame = 0; frame < 240; frame++) {
    targets.push((Math.floor(frame / 6) % 2 === 0) ? 0 : SECTOR);
  }
  const { seen } = drive(targets);
  const tail = seen.slice(120);
  const amplitude = Math.max(...tail) - Math.min(...tail);
  assert.equal(amplitude, 0,
    "a flap never persists long enough to be adopted — zero oscillation");
});

test("a real 90-degree turn adopts instantly and completes at full rate", () => {
  const targets = Array(60).fill(Math.PI / 2);
  const { seen } = drive(targets);
  const done = seen.findIndex((h) => Math.abs(angleDelta(h, Math.PI / 2)) < 0.001);
  assert.ok(done >= 0 && done <= 25, `turn completed at frame ${done} (~${(done / 60).toFixed(2)}s)`);
});

test("a PERSISTENT one-sector course change is adopted after the hold", () => {
  const targets = [0, ...Array(80).fill(SECTOR)];
  const { h, gate } = drive(targets);
  assert.ok(Math.abs(angleDelta(gate.adopted, SECTOR)) < 1e-9, "the new course was adopted");
  assert.ok(Math.abs(angleDelta(h, SECTOR)) < 0.001, "and the hull got there");
});

test("a slow genuine curve tracks through the gate (drifting candidate persists)", () => {
  // 0.01 rad/frame drift — a carrier arcing. Well under the adopt band
  // per-step, but the drifting candidate counts as persisting.
  const targets = [];
  for (let i = 0; i < 300; i++) targets.push(i * 0.01);
  const { h } = drive(targets);
  assert.ok(Math.abs(angleDelta(h, 2.99)) < 0.35,
    `the displayed heading follows the curve (ended ${h.toFixed(2)} vs 2.99)`);
});

test("the adopt band sits between one and two sectors — by construction", () => {
  assert.ok(ADOPT_BAND_RAD > SECTOR, "one-sector flaps fall INSIDE the gate");
  assert.ok(ADOPT_BAND_RAD < 2 * SECTOR, "two-sector turns adopt instantly");
});
