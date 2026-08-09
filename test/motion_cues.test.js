// test/motion_cues.test.js — 14C motion pass batch 1: the pure math the
// renderer trusts. Recoil lands exactly home, tracers arc only for
// indirect chassis with BOTH ends visible, dust respects cadence.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapEventsToMotion, recoilKick, tracerPoint, dustStep,
  motionAge, pruneMotion, MOTION_TTL_MS,
} from "../client/js/motion_cues.js";
import { UNIT_ARTILLERY } from "../engine/units.js";

const view = {
  friendlyAssets: [
    { id: 2, x: 10 * 256, y: 10 * 256, type: UNIT_ARTILLERY },
    { id: 3, x: 12 * 256, y: 10 * 256, type: 0 },
  ],
  visibleEnemies: [{ id: 9, x: 20 * 256, y: 10 * 256, type: 0 }],
};

test("fire_resolved: recoil for any visible attacker; tracer only for indirect", () => {
  const cues = mapEventsToMotion(
    [
      { type: "fire_resolved", attackerId: 2, targetId: 9 }, // artillery
      { type: "fire_resolved", attackerId: 3, targetId: 9 }, // tank
    ],
    view, 1000
  );
  // prompt 221: every visible shot also flashes at the muzzle
  assert.deepEqual(cues.map((c) => c.kind),
    ["recoil", "muzzle", "tracer", "recoil", "muzzle"]);
  const tracer = cues[2];
  assert.deepEqual(tracer.from, { x: 10.5, y: 10.5 });
  assert.deepEqual(tracer.to, { x: 20.5, y: 10.5 });
});

test("fog: no cues for unseen attackers, no arcs to unseen targets", () => {
  const cues = mapEventsToMotion(
    [
      { type: "fire_resolved", attackerId: 77, targetId: 9 },  // unseen attacker
      { type: "fire_resolved", attackerId: 2, targetId: 78 },  // unseen target
    ],
    view, 0
  );
  assert.deepEqual(cues.map((c) => c.kind), ["recoil", "muzzle"],
    "recoil+flash yes, arc out of fog no, nothing for the unseen attacker");
});

test("recoil curve: zero at both ends, peak at 20% of the life", () => {
  assert.equal(recoilKick(0), 0);
  assert.equal(recoilKick(1), 0);
  assert.equal(recoilKick(0.2), 1);
  assert.ok(recoilKick(0.1) > 0 && recoilKick(0.6) > 0);
});

test("tracer arc: endpoints on the ground, apex mid-flight", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 10, y: 0 };
  assert.equal(tracerPoint(from, to, 0).h, 0);
  assert.equal(tracerPoint(from, to, 1).h, 0);
  const mid = tracerPoint(from, to, 0.5);
  assert.deepEqual([mid.x, mid.h], [5, 1.6]);
});

test("dust cadence: needs real movement AND an elapsed interval", () => {
  let r = dustStep(0, 100, 0.00001);
  assert.equal(r.emit, false, "parked hulls make no dust");
  r = dustStep(0, 100, 0.01);
  assert.equal(r.emit, false, "too soon after the last puff");
  r = dustStep(0, 200, 0.01);
  assert.deepEqual(r, { emit: true, lastEmitMs: 200 });
});

test("cues age out on the vfx contract", () => {
  const cue = { kind: "recoil", bornMs: 0, ttlMs: MOTION_TTL_MS.recoil };
  assert.equal(motionAge(cue, 0), 0);
  assert.equal(motionAge(cue, 9999), 1);
  assert.deepEqual(pruneMotion([cue], 9999), []);
});
