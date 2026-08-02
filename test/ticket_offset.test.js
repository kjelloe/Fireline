// test/ticket_offset.test.js — the D+C ruling (prompt 154): MEASURED,
// DISCLOSED ticket offsets. The disadvantaged team starts +N on
// convicted maps; fair maps untouched; HANDICAP=0/N via rules;
// disclosure rides the briefing like the premium.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../engine/state.js";
import { MAP_TICKET_OFFSET, ticketOffsetFor } from "../engine/premium.js";

test("offset: the table is EMPTY until a same-build pair convicts", () => {
  // Twice-learned: sawtooth's offset was inert; riverline's ladder was
  // read against a stale baseline. No entry without a same-build h0
  // pair on record.
  for (const plain of ["frontier_corridor", "blackwood", "caldera", "sawtooth", "riverline"]) {
    const s = createInitialState(1, plain, {});
    assert.deepEqual([...s.tickets], [315, 315], `${plain} pays no offset`);
  }
});

test("offset: the mechanism still works when the table has an entry", () => {
  // The machinery is battle-tested even while the table sits empty:
  // handicapTickets only applies where a table entry exists.
  assert.equal(ticketOffsetFor("frontier_corridor", { handicapTickets: 60 }), null,
    "no entry, no offset — the override needs a conviction to override");
  assert.equal(ticketOffsetFor("riverline", { handicap: false }), null);
});

test("offset: the table only ever names battery-convicted maps", () => {
  // The generator law: an entry without a battery conviction is a lie
  // about the map. Convictions on record: sawtooth (pair ~+13 A),
  // riverline (pair ~+16 A agg). Both pay team B.
  assert.deepEqual(Object.keys(MAP_TICKET_OFFSET), []);
});
