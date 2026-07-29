// test/supply_drop.test.js — B6: the neutral supply drop.
//
// Deliberately NOT a site (the 13E lesson: sites move the majority
// denominator and project supply). Own hashed array, seed-scheduled,
// centred on the exact mirror line so neither side is closer by
// construction. Exclusive presence for DROP_HOLD_TICKS wins a ticket
// packet, once.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, RECOG_DROP } from "../engine/reducer.js";
import {
  createDrops, dropWorld, DROP_HOLD_TICKS, DROP_TICKET_PACKET,
  DROP_ACTIVATE_MIN, DROP_ROW_MIN, DROP_ROW_SPAN,
} from "../engine/drops.js";
import { hashState } from "../engine/snapshot.js";
import { buildView } from "../engine/view.js";
import { cellToWorld } from "../shared/fixedmath.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const OFF_BASES = [
  { team: 0, x: 0, y: 0, width: 4, height: 4 },
  { team: 1, x: 60, y: 60, width: 4, height: 4 },
];

// Park the drop where the test wants it: live now, at a known row.
function liveDrop(s, cellY = 30) {
  s.drops = [{ id: 0, cellY, activateTick: 0, holdTicks: 0, heldBy: -1, securedBy: -1 }];
  return s;
}

test("B6 the schedule is pure seed: same seed same drop, and it sits on the mirror line", () => {
  assert.deepEqual(createDrops(2026), createDrops(2026));
  const d = createDrops(2026)[0];
  assert.ok(d.cellY >= DROP_ROW_MIN && d.cellY < DROP_ROW_MIN + DROP_ROW_SPAN);
  assert.ok(d.activateTick >= DROP_ACTIVATE_MIN);
  // The one x that reflects onto itself: x' = W*256 - x == x.
  const w = dropWorld(d, 128);
  assert.equal(128 * 256 - w.x, w.x, "exactly on the mirror line");
});

test("B6 exclusive holding wins the packet — tickets, recognition, one shot", () => {
  // The sandbox map is 64 wide, so the ring sits at world x = 64*256/2.
  let s = liveDrop(sandbox([
    { team: 0, cellX: 32, cellY: 30 },   // in the ring (centre x = cell 31.5ish)
    { team: 1, cellX: 50, cellY: 50 },   // far away
  ], [], { bases: OFF_BASES }), 30);
  s = joinAndSelect(s, 0, 0, 0);
  s.tickets = [200, 200];
  for (let i = 0; i <= DROP_HOLD_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.drops[0].securedBy, 0, "team 0 held it out");
  assert.equal(s.tickets[0], 200 + DROP_TICKET_PACKET, "the packet landed");
  assert.equal(s.tickets[1], 200, "the other pool is untouched");
  assert.equal(s.operators[0].score, RECOG_DROP, "the crew on the spot got seen");
  const spent = apply(s, { type: "advance_tick" });
  assert.equal(spent.tickets[0], s.tickets[0], "one shot — no second packet");
  assert.equal(buildView(spent, 0).drops.length, 0, "a spent drop leaves the view");
});

test("B6 a contested ring resets the hold — defence is the counterplay", () => {
  let s = liveDrop(sandbox([
    { team: 0, cellX: 32, cellY: 30 },
    { team: 1, cellX: 33, cellY: 30 },   // both in the ring
  ], [], { bases: OFF_BASES }), 30);
  s = joinAndSelect(s, 0, 0, 0);
  s = joinAndSelect(s, 16, 1, 1);
  for (let i = 0; i < DROP_HOLD_TICKS * 2; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.drops[0].securedBy, -1, "nobody wins a contested crate");
  assert.equal(s.drops[0].holdTicks, 0, "the clock is not banked");
});

test("B6 the packet never lifts a pool over its ceiling", () => {
  let s = liveDrop(sandbox([{ team: 0, cellX: 32, cellY: 30 }], [], { bases: OFF_BASES }), 30);
  s = joinAndSelect(s, 0, 0, 0);
  s.tickets = [s.rules.ticketPool - 3, 100];
  for (let i = 0; i <= DROP_HOLD_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.tickets[0], s.rules.ticketPool, "capped at the session pool");
});

test("B6 activation announces itself and the drop is hashed state", () => {
  let s = liveDrop(sandbox([{ team: 0, cellX: 5, cellY: 5 }], [], { bases: OFF_BASES }), 30);
  s.drops[0].activateTick = 3;
  const before = hashState(s);
  for (let i = 0; i < 3; i++) s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some((e) => e.type === "supply_drop_incoming"),
    "the war is told, both teams at once");
  assert.ok(buildView(s, 1).drops.length === 1, "and the enemy view carries it too");
  s.drops[0].holdTicks = 7;
  assert.notEqual(hashState(s), before, "hold progress is hashed");
});
