// test/uav_sweep.test.js — W4-7 (Q79 ruling, prompt 175): the
// RECOGNITION SINK. Recognition had only ever been a tally; a sink
// turns it into a decision. The honesty rule is the interesting part:
// honors and the scoreboard keep judging what you EARNED, so buying a
// sweep can never cost you a medal — spending draws from a separate
// wallet that earning also fills.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, UAV_COST, UAV_TICKS } from "../engine/reducer.js";
import { UAV_RADIUS_CELLS } from "../engine/uav.js";
import { computeVisible } from "../engine/los.js";
import { sandbox, joinAndSelect } from "./helpers.js";

function callerState({ credit = 100 } = {}) {
  // My scout at (10,10); an enemy far away at (60,60) — outside every
  // sensor, so only a sweep can reveal it.
  let s = sandbox([
    { team: 0, type: 1, cellX: 10, cellY: 10 },
    { team: 1, type: 0, cellX: 60, cellY: 60 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s.operators[0].recogAvailable = credit;
  return s;
}

test("W4-7: a sweep reveals the patch it was called on, for the whole team", () => {
  let s = callerState();
  assert.ok(!computeVisible(s, 0).has(1), "the enemy is dark beforehand");
  s = apply(s, { type: "call_uav", operatorId: 0, cellX: 60, cellY: 60 });
  assert.equal(s.uavSweeps.length, 1);
  assert.ok(computeVisible(s, 0).has(1), "and lit while the sweep runs");
  assert.ok(!computeVisible(s, 1).has(0), "the sweep is not shared with the enemy");
});

test("W4-7: it costs the RULED price from the wallet, never from the record", () => {
  let s = callerState({ credit: UAV_COST });
  const scoreBefore = s.operators[0].score;
  s = apply(s, { type: "call_uav", operatorId: 0, cellX: 60, cellY: 60 });
  assert.equal(s.operators[0].recogAvailable, 0, "the wallet paid");
  assert.equal(s.operators[0].score, scoreBefore,
    "the EARNED record is untouched — spending must never cost a medal");
});

test("W4-7: too poor, no sweep", () => {
  let s = callerState({ credit: UAV_COST - 1 });
  s = apply(s, { type: "call_uav", operatorId: 0, cellX: 60, cellY: 60 });
  assert.equal(s.uavSweeps.length, 0);
  assert.equal(s.events.find((e) => e.type === "rejected").reason, "not enough recognition");
});

test("W4-7: earning fills the wallet as well as the record", () => {
  let s = callerState({ credit: 0 });
  s.operators[0].score = 0;
  // A kill pays both.
  s.assets[1].hp = 1;
  s.assets[1].x = 11 * 256 + 128;
  s.assets[1].y = 10 * 256 + 128;
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.ok(s.operators[0].score > 0, "the record grew");
  assert.equal(s.operators[0].recogAvailable, s.operators[0].score,
    "and the wallet grew by the same amount");
});

test("W4-7: the sweep expires on its own clock", () => {
  let s = callerState();
  s = apply(s, { type: "call_uav", operatorId: 0, cellX: 60, cellY: 60 });
  for (let i = 0; i < UAV_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.uavSweeps.length, 0, "dispersed");
  assert.ok(!computeVisible(s, 0).has(1), "and the patch goes dark again");
});

test("W4-7: the sweep BEATS smoke — you paid for it", () => {
  // A screen that defeated an aircraft would make the sink worthless.
  let s = callerState();
  s.smokes = [{ id: 0, team: 1, cellX: 60, cellY: 60, ticks: 500 }];
  s = apply(s, { type: "call_uav", operatorId: 0, cellX: 60, cellY: 60 });
  assert.ok(computeVisible(s, 0).has(1), "smoke does not hide from a sweep");
});

test("W4-7: UAV=0 disables the sink", () => {
  let s = callerState();
  s.rules = { ...s.rules, uavSweep: false };
  s = apply(s, { type: "call_uav", operatorId: 0, cellX: 60, cellY: 60 });
  assert.equal(s.uavSweeps.length, 0);
  assert.equal(s.events.find((e) => e.type === "rejected").reason, "uav disabled");
});
