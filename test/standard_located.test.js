// test/standard_located.test.js — prompt 232: the sneak's reward.
// Touching the enemy standard AT ITS BASE pays +1 Recognition once per
// war (hashed operator.stdLocated); a carried or dropped standard pays
// nothing (the run into the CAMP is what's being rewarded).

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { sandbox, joinAndSelect } from "./helpers.js";

function campWorld() {
  let s = sandbox([{ team: 0, type: 1, cellX: 20, cellY: 20 }]);
  s.standards = [
    { id: 0, team: 0, status: 0, x: 5 * 256 + 128, y: 5 * 256 + 128,
      homeCellX: 5, homeCellY: 5, carrierAssetId: -1, droppedTimer: 0 },
    { id: 1, team: 1, status: 0, x: 20 * 256 + 128, y: 21 * 256 + 128,
      homeCellX: 20, homeCellY: 21, carrierAssetId: -1, droppedTimer: 0 },
  ];
  s = joinAndSelect(s, 0, 0, 0); // scout parked one cell from THEIR standard
  return s;
}

test("touching the enemy standard at base pays +1 once, with the event", () => {
  let s = campWorld();
  const before = s.operators[0].score;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.operators[0].score, before + 1, "+1 recognition");
  assert.equal(s.operators[0].stdLocated, 1, "the once-flag is set (hashed)");
  assert.ok(s.events.some((e) => e.type === "standard_located" && e.operatorId === 0));
  const again = apply(s, { type: "advance_tick" });
  assert.equal(again.operators[0].score, before + 1, "never pays twice");
});

test("your OWN standard pays nothing, and a carried standard pays nothing", () => {
  let s = campWorld();
  s.standards[1].status = 1; // carried — not standing in the camp
  const before = s.operators[0].score;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.operators[0].score, before, "no award off the base");
  assert.equal(s.operators[0].stdLocated, 0);
});

// The card side (prompt 232 review): the mission shows until done.
test("the locate_standard card gates on the own-seat flag", async () => {
  const { tasksFor } = await import("../client/js/tasks_model.js");
  const view = {
    team: 0,
    operators: [{ id: 0, team: 0, stdLocated: 0 }],
    standards: [
      { team: 0, status: 0, x: 5 * 256, y: 5 * 256 },
      { team: 1, status: 0, x: 60 * 256, y: 60 * 256 },
    ],
  };
  assert.ok(tasksFor(view, 0).some((c) => c.kind === "locate_standard"), "offered while undone");
  view.operators[0].stdLocated = 1;
  assert.ok(!tasksFor(view, 0).some((c) => c.kind === "locate_standard"), "retires when done");
  view.operators[0].stdLocated = 0;
  view.standards[1].status = 1; // carried — not standing in the camp
  assert.ok(!tasksFor(view, 0).some((c) => c.kind === "locate_standard"), "only an AT-BASE standard");
});
