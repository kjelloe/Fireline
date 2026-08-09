// test/intruder_alarm.test.js — prompt 221: the compound SHOUTS.
// The watch law (160.2) already makes an enemy inside or hard against
// the base rect always-seen; the alarm adds ATTENTION on top — a toTeam
// ping at the intruder every 300 ticks while one stands in the zone.
// Stateless cooldown (tick % 300), nothing hashed. The client's
// INTRUDER card (tasks_model) derives from the same geometry.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { sandbox, joinAndSelect } from "./helpers.js";
import { tasksFor } from "../client/js/tasks_model.js";

const BASES = [
  { team: 0, x: 4, y: 20, width: 10, height: 10 },
  { team: 1, x: 50, y: 20, width: 10, height: 10 },
];

function world(intruderCellX, intruderCellY) {
  let s = sandbox(
    [{ team: 1, type: 0, cellX: intruderCellX, cellY: intruderCellY }],
    [], { bases: BASES }
  );
  s = joinAndSelect(s, 20, 1, 0); // crewed — an empty hull is no intruder
  return s;
}

function tickTo300(s) {
  // The alarm fires on tick % 300 === 0; walk exactly onto the boundary.
  s.tick = 299;
  return apply(s, { type: "advance_tick" });
}

test("an enemy inside the compound trips the intruder alarm for the DEFENDER", () => {
  const s = tickTo300(world(8, 24)); // deep inside team 0's base
  const alarm = s.events.find((e) => e.type === "ping" && e.kind === "intruder_alarm");
  assert.ok(alarm, "the compound shouts");
  assert.equal(alarm.toTeam, 0, "the defenders hear it");
  assert.deepEqual([alarm.cellX, alarm.cellY], [8, 24], "at the intruder");
});

test("hard against the wall (+1) still counts — the watch law's own zone", () => {
  const s = tickTo300(world(3, 24)); // one cell west of the rect
  assert.ok(s.events.some((e) => e.kind === "intruder_alarm"));
});

test("outside the zone: silence; off the 300-boundary: silence", () => {
  const far = tickTo300(world(30, 24));
  assert.equal(far.events.some((e) => e.kind === "intruder_alarm"), false);
  let s = world(8, 24);
  s.tick = 100;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.events.some((e) => e.kind === "intruder_alarm"), false,
    "the stateless cooldown is the tick boundary");
});

test("the client card: an intruder in MY base raises INTRUDER, fog-free", () => {
  const view = {
    team: 0,
    bases: BASES,
    visibleEnemies: [{ id: 9, team: 1, state: 1, x: 8 * 256 + 128, y: 24 * 256 + 128 }],
  };
  const cards = tasksFor(view, 0);
  const card = cards.find((c) => c.kind === "intruder");
  assert.ok(card, "the card exists");
  assert.deepEqual([card.cellX, card.cellY], [8, 24]);
  // A wreck in the base is a prize, not an intruder.
  view.visibleEnemies[0].state = 2;
  assert.equal(tasksFor(view, 0).some((c) => c.kind === "intruder"), false);
});
