// test/milestone3d.test.js — Milestone 3D: indirect fire & the spotter doctrine.
// Artillery reaches 12 cells but needs a teammate (e.g. a scout) to spot the
// target; every chassis needs the target team-visible; minimum range keeps
// artillery from point-blank work.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { UNIT_SCOUT, UNIT_ARTILLERY, getUnitStats } from "../engine/units.js";
import { SUPPRESSION_TICKS } from "../engine/combat.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const CELLS = (n) => n * 256;

test("3D artillery hits a scout-spotted target ten cells out", () => {
  let s = sandbox([
    { team: 0, cellX: 0, type: UNIT_ARTILLERY },   // 0 gunner
    { team: 0, cellX: 8, type: UNIT_SCOUT },        // 1 spotter
    { team: 1, cellX: 10 },                          // 2 target (10 cells from gun)
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 2 });
  assert.equal(s.events[0].type, "fire_resolved");
  assert.equal(s.events[0].hpDelta, 30, "artillery damage");
  assert.equal(s.assets[2].hp, 70);
});

test("3D artillery without any spotter is rejected", () => {
  let s = sandbox([
    { team: 0, cellX: 0, type: UNIT_ARTILLERY, suppressedTimer: 10 }, // sensor 6
    { team: 1, cellX: 10 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.deepEqual(s.events, [
    { type: "rejected", cmd: "fire_order", reason: "target not spotted" },
  ]);
});

test("3D suppressed artillery still fires on a team-spotted target", () => {
  let s = sandbox([
    { team: 0, cellX: 0, type: UNIT_ARTILLERY, suppressedTimer: SUPPRESSION_TICKS },
    { team: 0, cellX: 9, type: UNIT_SCOUT },
    { team: 1, cellX: 10 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 2 });
  assert.equal(s.events[0].type, "fire_resolved", "indirect ignores own sensor");
});

test("3D artillery minimum range rejects point-blank targets", () => {
  const minCells = getUnitStats(UNIT_ARTILLERY).minRange / 256;
  let s = sandbox([
    { team: 0, cellX: 0, type: UNIT_ARTILLERY },
    { team: 1, cellX: minCells - 1 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.deepEqual(s.events, [
    { type: "rejected", cmd: "fire_order", reason: "target out of range" },
  ]);
});

test("3D artillery maximum range still applies", () => {
  let s = sandbox([
    { team: 0, cellX: 0, type: UNIT_ARTILLERY },
    { team: 0, cellX: 12, type: UNIT_SCOUT },
    { team: 1, cellX: 13 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 2 });
  assert.deepEqual(s.events, [
    { type: "rejected", cmd: "fire_order", reason: "target out of range" },
  ]);
});

test("3D wreck spotters do not spot for artillery", () => {
  let s = sandbox([
    { team: 0, cellX: 0, type: UNIT_ARTILLERY, suppressedTimer: 10 }, // own sensor 6 < 10
    { team: 0, cellX: 8, type: UNIT_SCOUT, state: 2, hp: 0 }, // wrecked spotter
    { team: 1, cellX: 10 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 2 });
  assert.equal(s.events[0].reason, "target not spotted");
});
