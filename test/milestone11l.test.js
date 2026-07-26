// test/milestone11l.test.js — Slice 11L: direct control, all chassis
// (prompt 16 Q10, prompt 19). Authoritative intent physics: turn at the
// chassis rate, drive along the heading, reverse at half, every existing
// speed multiplier honored. The Firepower homage mode.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { validate } from "../engine/commands.js";
import { getUnitStats, UNIT_STATS } from "../engine/units.js";
import { ASSET_MOVING } from "../engine/state.js";
import { CAMP_TICKS } from "../engine/drone.js";
import { hashState } from "../engine/snapshot.js";
import { sandbox, joinAndSelect } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

const OFF_BASES = [
  { team: 0, x: 0, y: 60, width: 4, height: 4 },
  { team: 1, x: 60, y: 60, width: 4, height: 4 },
];

function driver(spec = {}) {
  let s = sandbox([{ team: 0, cellX: 30, cellY: 30, ...spec }]);
  return joinAndSelect(s, 0, 0, 0);
}

test("11L throttle drives along the heading at chassis speed; reverse at half", () => {
  let s = driver(); // tank, heading 0 = east, speed 32
  s = apply(s, { type: "drive", operatorId: 0, throttle: 1, turn: 0 });
  const x0 = s.assets[0].x;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].x - x0, 32, "full speed east");
  assert.equal(s.assets[0].y, cellToWorld(30), "no drift");

  s = apply(s, { type: "drive", operatorId: 0, throttle: -1, turn: 0 });
  const x1 = s.assets[0].x;
  s = apply(s, { type: "advance_tick" });
  assert.equal(x1 - s.assets[0].x, 16, "reverse gear is half speed");
});

test("11L steering pivots at the chassis turn rate — every chassis", () => {
  for (const type of Object.keys(UNIT_STATS).map(Number)) {
    let s = driver({ type });
    s = apply(s, { type: "drive", operatorId: 0, throttle: 0, turn: 1 });
    s = apply(s, { type: "advance_tick" });
    assert.equal(s.assets[0].heading, getUnitStats(type).turnRate & 255,
      `chassis ${type} turns at its own rate`);
    s = apply(s, { type: "drive", operatorId: 0, throttle: 0, turn: -1 });
    s = apply(s, { type: "advance_tick" });
    assert.equal(s.assets[0].heading, 0, `chassis ${type} steers back`);
  }
});

test("11L drive intent cancels click-move; zeroing restores it", () => {
  let s = driver();
  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 50, targetCellY: 30 });
  assert.equal(s.assets[0].state, ASSET_MOVING);
  s = apply(s, { type: "drive", operatorId: 0, throttle: 1, turn: 0 });
  assert.equal(s.assets[0].state, 0, "the wheel overrides the waypoint");
  assert.equal(s.assets[0].targetX, s.assets[0].x);

  s = apply(s, { type: "drive", operatorId: 0, throttle: 0, turn: 0 });
  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 33, targetCellY: 30 });
  for (let i = 0; i < 40; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].x, cellToWorld(33), "click-to-move works again");
});

test("11L out of supply halves drive speed; a wreck holds no wheel", () => {
  let dry = sandbox([{ team: 0, cellX: 30, cellY: 30 }], [], { bases: OFF_BASES });
  dry = joinAndSelect(dry, 0, 0, 0);
  dry = apply(dry, { type: "drive", operatorId: 0, throttle: 1, turn: 0 });
  const x0 = dry.assets[0].x;
  dry = apply(dry, { type: "advance_tick" });
  assert.equal(dry.assets[0].x - x0, 16, "unsupplied crawl");

  let s = sandbox([
    { team: 0, cellX: 10, driveThrottle: 1, hp: 10 },
    { team: 1, cellX: 12 },
    { team: 0, cellX: 50 },
  ]);
  s = joinAndSelect(s, 16, 1, 1);
  s = apply(s, { type: "fire_order", operatorId: 16, targetAssetId: 0 });
  assert.equal(s.assets[0].driveThrottle, 0, "disablement clears the intent");
});

test("11L a seat at the wheel is not camping", () => {
  let s = sandbox(
    [{ team: 0, cellX: 30, cellY: 30, driveTurn: 1 }],
    [{ cellX: 2, cellY: 56, owner: 0 }, { cellX: 50, cellY: 50, owner: 1 }],
    { bases: OFF_BASES }
  );
  for (let i = 0; i < CAMP_TICKS + 10; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.drones.length, 0, "pivoting in place draws no drone");
  assert.equal(s.assets[0].campTicks, 0);
});

test("11L validation and determinism", () => {
  assert.equal(validate({ type: "drive", operatorId: 0, throttle: 2, turn: 0 }).ok, false);
  assert.equal(validate({ type: "drive", operatorId: 0, throttle: 1, turn: -1 }).ok, true);

  const run = () => {
    let s = driver();
    s = apply(s, { type: "drive", operatorId: 0, throttle: 1, turn: 1 });
    for (let i = 0; i < 50; i++) s = apply(s, { type: "advance_tick" });
    return hashState(s);
  };
  assert.equal(run(), run());
});
