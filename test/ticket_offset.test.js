// test/ticket_offset.test.js — the D+C ruling (prompt 154): MEASURED,
// DISCLOSED ticket offsets. The disadvantaged team starts +N on
// convicted maps; fair maps untouched; HANDICAP=0/N via rules;
// disclosure rides the briefing like the premium.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../engine/state.js";
import { MAP_TICKET_OFFSET, ticketOffsetFor } from "../engine/premium.js";

test("offset: convicted maps seed the disadvantaged pool; others never", () => {
  const rl = createInitialState(1, "riverline", {});
  assert.equal(rl.tickets[1], 315 + MAP_TICKET_OFFSET.riverline.tickets);
  // Sawtooth: offsets measured INERT (h20-h60 moved the lean ~1 pt) —
  // dropped from the table; a no-op "measured offset" would be a lie.
  for (const plain of ["frontier_corridor", "blackwood", "caldera", "sawtooth"]) {
    const s = createInitialState(1, plain, {});
    assert.deepEqual([...s.tickets], [315, 315], `${plain} pays no offset`);
  }
});

test("offset: HANDICAP=0 disables; a number overrides the ladder knob", () => {
  const off = createInitialState(1, "riverline", { handicap: false });
  assert.deepEqual([...off.tickets], [315, 315]);
  const n = createInitialState(1, "riverline", { handicapTickets: 60 });
  assert.deepEqual([...n.tickets], [315, 375]);
  assert.equal(ticketOffsetFor("frontier_corridor", {}), null);
});

test("offset: the table only ever names battery-convicted maps", () => {
  // The generator law: an entry without a battery conviction is a lie
  // about the map. Convictions on record: sawtooth (pair ~+13 A),
  // riverline (pair ~+16 A agg). Both pay team B.
  assert.deepEqual(Object.keys(MAP_TICKET_OFFSET).sort(), ["riverline"]);
  for (const e of Object.values(MAP_TICKET_OFFSET)) assert.equal(e.team, 1);
});
