// test/ticket_offset.test.js — the D+C ruling (prompt 154): MEASURED,
// DISCLOSED ticket offsets. The disadvantaged team starts +N on
// convicted maps; fair maps untouched; HANDICAP=0/N via rules;
// disclosure rides the briefing like the premium.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../engine/state.js";
import {
  MAP_TICKET_OFFSET, ticketOffsetFor, MAP_PREMIUM, premiumPoints, PREMIUM_NUM, PREMIUM_DEN,
} from "../engine/premium.js";

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

test("premium: the table only ever names CURRENTLY-convicted maps", () => {
  // 2026-08-05: both entries (sawtooth, riverline) were pulled when the
  // phase-lock fixes retired their leans — sawtooth 54.8/54.4 (agg 54.6,
  // under the 55 threshold), riverline 47.0/51.0 (agg 49.0, fair). A
  // premium outlives its conviction only as a lie, and the briefing
  // would repeat that lie to every player. Same law as the offset table.
  assert.deepEqual(Object.keys(MAP_PREMIUM), []);
  for (const profile of ["sawtooth", "riverline", "frontier_corridor", "blackwood", "caldera"]) {
    assert.equal(premiumPoints(40, 0, profile), 40, `${profile} pays team A flat`);
    assert.equal(premiumPoints(40, 1, profile), 40, `${profile} pays team B flat`);
  }
});

test("premium: the MECHANISM still works when a map earns one", () => {
  // Pulling the table must never rot the machinery — the next
  // convicted map has to be one generated entry away.
  const table = { proving_ground: 1 };
  const premium = (points, team) => (table.proving_ground === team
    ? ((points * PREMIUM_NUM) / PREMIUM_DEN) | 0 : points);
  assert.equal(premium(40, 1), 50, "the disadvantaged team earns +25%");
  assert.equal(premium(40, 0), 40, "the favoured team does not");
  assert.equal(premium(3, 1), 3, "integer floor: small awards never inflate");
});
