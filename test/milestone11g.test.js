// test/milestone11g.test.js — Slice 11G: rescue autopilot option
// (prompt 16 Q8, prompt 19 confirmation). Automatic boarding by default;
// autoRescue=0 seats board/unboard by explicit command.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { OP_DOWN, OP_ACTIVE } from "../engine/state.js";
import { hashState } from "../engine/snapshot.js";
import { sandbox } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

const OFF_BASES = [
  { team: 0, x: 0, y: 0, width: 4, height: 4 },
  { team: 1, x: 60, y: 60, width: 4, height: 4 },
];

// A carrier at (30,30) with operator 3's body one cell away.
function rescueScene(autoRescue) {
  let s = sandbox([{ team: 0, cellX: 30, cellY: 30, type: 4 }], [], { bases: OFF_BASES });
  s.operators[3] = { ...s.operators[3], state: OP_DOWN, team: 0, assetId: -1, autoRescue };
  s.downed.push({
    operatorId: 3, team: 0,
    x: cellToWorld(31), y: cellToWorld(30),
    targetX: cellToWorld(31), targetY: cellToWorld(30), downTicks: 0,
  });
  return s;
}

test("11G autoRescue on (the default): the adjacent carrier scoops you up", () => {
  let s = rescueScene(1);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].aboard1, 3);
  assert.equal(s.downed.length, 0);
});

test("11G autoRescue off: the carrier waits; B boards on command", () => {
  let s = rescueScene(0);
  for (let i = 0; i < 5; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].aboard1, -1, "no auto-scoop for a manual seat");
  assert.equal(s.downed.length, 1, "still walking");

  s = apply(s, { type: "board_carrier", operatorId: 3, carrierAssetId: 0 });
  assert.equal(s.assets[0].aboard1, 3);
  assert.ok(s.events.some((e) => e.type === "operator_rescued"));
});

test("11G set_option flips the flag; validation guards the shape", () => {
  let s = sandbox([{ team: 0, cellX: 10 }], [], { bases: OFF_BASES });
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  assert.equal(s.operators[0].autoRescue, 1, "on by default");
  s = apply(s, { type: "set_option", operatorId: 0, option: "auto_rescue", value: 0 });
  assert.equal(s.operators[0].autoRescue, 0);
  assert.ok(s.events.some((e) => e.type === "option_set"));

  const bad = apply(s, { type: "set_option", operatorId: 0, option: "wallhack", value: 1 });
  assert.equal(bad.events[0].reason, "unknown option");
  const badVal = apply(s, { type: "set_option", operatorId: 0, option: "auto_rescue", value: 7 });
  assert.equal(badVal.events[0].reason, "invalid value");
});

test("11G boarding rejections: reach, bunks, team, standing seats", () => {
  const far = rescueScene(0);
  far.downed[0].x = cellToWorld(40);
  const noReach = apply(far, { type: "board_carrier", operatorId: 3, carrierAssetId: 0 });
  assert.equal(noReach.events[0].reason, "carrier out of reach");

  const full = rescueScene(0);
  full.assets[0].aboard1 = 5;
  full.assets[0].aboard2 = 6;
  const noBunk = apply(full, { type: "board_carrier", operatorId: 3, carrierAssetId: 0 });
  assert.equal(noBunk.events[0].reason, "no bunk free");

  const standing = sandbox([{ team: 0, cellX: 30, type: 4 }], [], { bases: OFF_BASES });
  const notDown = apply(standing, { type: "board_carrier", operatorId: 3, carrierAssetId: 0 });
  assert.equal(notDown.events[0].reason, "not downed");
});

test("11G unboard: hop out anywhere, back on foot beside the carrier", () => {
  let s = rescueScene(1);
  s = apply(s, { type: "advance_tick" }); // auto-board
  s.assets[0].x = cellToWorld(45);
  s.assets[0].y = cellToWorld(45);
  s = apply(s, { type: "unboard", operatorId: 3 });
  assert.equal(s.assets[0].aboard1, -1);
  assert.equal(s.downed.length, 1);
  assert.equal(s.downed[0].operatorId, 3);
  assert.ok(s.events.some((e) => e.type === "operator_unboarded"));
  assert.equal(s.operators[3].state, OP_DOWN, "on foot again, not delivered");

  const notAboard = apply(s, { type: "unboard", operatorId: 3 });
  assert.equal(notAboard.events[0].reason, "not aboard");
});

test("11G autoRescue is hashed; AI seats keep the default", () => {
  const a = rescueScene(1);
  const b = rescueScene(1);
  b.operators[3].autoRescue = 0;
  assert.notEqual(hashState(a), hashState(b));

  const s = sandbox([{ team: 0, cellX: 10 }], [], { bases: OFF_BASES });
  for (const op of s.operators) assert.equal(op.autoRescue, 1);
});
