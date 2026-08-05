// test/pow_creators.test.js — W4-8 (Q78 ruling, prompts 175/182): the
// POW CREATORS. Until now the ONLY way to take a prisoner was a scout
// abducting a downed crew, which is why prisons sat empty in standard
// wars and half the POW arc was unreachable in normal play. These four
// paths all reuse OP_CAPTIVE + prisons exactly as built — no new hashed
// field, only new ways to reach a state that already existed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { OP_CAPTIVE } from "../engine/state.js";
import { OPERATOR_AUTO_RETURN_TICKS } from "../engine/downed.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const CELL = 256;
const at = (c) => c * CELL + 128;

// Bases small enough to be real compounds (the whole-map sandbox
// default has no walls and so cannot capture anyone).
function powWorld(bodyCell) {
  let s = sandbox([{ team: 0, type: 0, cellX: 5, cellY: 5 }], [], {
    bases: [
      { team: 0, x: 0, y: 0, width: 6, height: 10 },
      { team: 1, x: 100, y: 0, width: 6, height: 10 },
    ],
  });
  s.prisons = [
    { team: 0, cellX: 3, cellY: 60, pows: [], raidTicks: 0, alarmTicks: 0 },
    { team: 1, cellX: 120, cellY: 60, pows: [], raidTicks: 0, alarmTicks: 0 },
  ];
  s.downed = [{
    operatorId: 4, team: 0, x: at(bodyCell[0]), y: at(bodyCell[1]),
    targetX: at(bodyCell[0]), targetY: at(bodyCell[1]),
    downTicks: 0, freedPow: 0,
  }];
  s.operators[4] = { ...s.operators[4], team: 0, state: 1, assetId: -1 };
  return s;
}

test("W4-8b: nerve running out INSIDE the enemy compound = captured", () => {
  let s = powWorld([102, 4]); // deep in team 1's base rect
  // events are per-tick, so collect as we go rather than reading the last frame
  const seen = [];
  for (let i = 0; i < OPERATOR_AUTO_RETURN_TICKS + 2; i++) {
    s = apply(s, { type: "advance_tick" });
    seen.push(...s.events);
  }
  assert.equal(s.operators[4].state, OP_CAPTIVE, "the garrison took them");
  const prison = s.prisons.find((p) => p.team === 1);
  assert.equal(prison.pows.length, 1);
  assert.equal(prison.pows[0].id, 4);
  assert.ok(seen.some((e) => e.type === "operator_captured" && e.how === "deep_down"));
});

test("W4-8b: the SAME timer in open ground still walks home", () => {
  let s = powWorld([60, 40]); // no compound anywhere near
  for (let i = 0; i < OPERATOR_AUTO_RETURN_TICKS + 2; i++) {
    s = apply(s, { type: "advance_tick" });
  }
  assert.notEqual(s.operators[4].state, OP_CAPTIVE, "open ground is not a prison");
  assert.equal(s.prisons.find((p) => p.team === 1).pows.length, 0);
});

test("W4-8b: your OWN compound never captures you", () => {
  let s = powWorld([2, 4]); // inside team 0's own base
  for (let i = 0; i < OPERATOR_AUTO_RETURN_TICKS + 2; i++) {
    s = apply(s, { type: "advance_tick" });
  }
  assert.notEqual(s.operators[4].state, OP_CAPTIVE);
});

test("W4-8b: a FULL prison cannot hold another — the body carries on", () => {
  let s = powWorld([102, 4]);
  const prison = s.prisons.find((p) => p.team === 1);
  prison.pows = [{ id: 20, by: -1 }, { id: 21, by: -1 }, { id: 22, by: -1 },
    { id: 23, by: -1 }, { id: 24, by: -1 }, { id: 25, by: -1 }];
  const before = prison.pows.length;
  for (let i = 0; i < OPERATOR_AUTO_RETURN_TICKS + 2; i++) {
    s = apply(s, { type: "advance_tick" });
  }
  assert.equal(s.prisons.find((p) => p.team === 1).pows.length, before,
    "capacity wins — the arc's own rule is not bypassed");
});

test("W4-8c: downed at a prison with the ALARM live = captured", () => {
  let s = powWorld([120, 60]); // right on team 1's wire
  s.prisons.find((p) => p.team === 1).alarmTicks = 100; // the alarm is up
  s = apply(s, { type: "advance_tick" }); // fires at downTicks === 1
  assert.equal(s.operators[4].state, OP_CAPTIVE, "raiders caught at the wire are taken");
  assert.ok(s.events.some((e) => e.type === "operator_captured" && e.how === "failed_raid"));
});

test("W4-8c: the same wire with NO alarm lets them lie there", () => {
  let s = powWorld([120, 60]);
  s = apply(s, { type: "advance_tick" });
  assert.notEqual(s.operators[4].state, OP_CAPTIVE,
    "a quiet compound is not watching — the alarm is the trigger");
});

test("W4-8: the victim's team is PINGED wherever it happens", () => {
  let s = powWorld([120, 60]);
  s.prisons.find((p) => p.team === 1).alarmTicks = 100;
  s = apply(s, { type: "advance_tick" });
  const ping = s.events.find((e) => e.type === "ping" && e.kind === "need_rescue");
  assert.ok(ping, "the chase begins, as with the scout abduction");
  assert.equal(ping.toTeam, 0);
});

test("W4-8: a freed POW is never re-captured by these paths", () => {
  // The re-secure rule owns that case; these creators must not
  // double-dip on a body that is already the prison arc's business.
  let s = powWorld([120, 60]);
  s.downed[0].freedPow = 1;
  s.prisons.find((p) => p.team === 1).alarmTicks = 100;
  s = apply(s, { type: "advance_tick" });
  assert.notEqual(s.operators[4].state, OP_CAPTIVE);
});
