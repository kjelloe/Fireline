// test/ticket_bleed.test.js — 13H hybrid ticket bleed (prompt-51 ruling).
// Relay MAJORITY drains the enemy pool one ticket per cadence; an empty
// pool loses the war (WIN_TICKETS); no majority = no bleed; the horn and
// every earlier condition stay untouched (hybrid, not replacement).

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, createInitialState } from "../engine/reducer.js";
import { DEFAULT_RULES } from "../engine/state.js";
import { WIN_TICKETS } from "../engine/victory.js";
import { sandbox } from "./helpers.js";

function withRelays(owners, extra = {}) {
  // Enough live assets on both teams that nothing ends by elimination.
  let s = sandbox(
    [
      { team: 0, cellX: 5, cellY: 5 }, { team: 0, cellX: 7, cellY: 5 },
      { team: 1, cellX: 60, cellY: 60 }, { team: 1, cellX: 62, cellY: 60 },
    ],
    owners.map((owner, i) => ({ cellX: 10 + i * 3, cellY: 50, owner }))
  );
  s.rules = { ...s.rules, ticketMajority: 3, ticketBleedTicks: 10, ...extra };
  s.tickets = [extra.pool ?? 20, extra.pool ?? 20];
  return s;
}

test("13H: relay majority bleeds the ENEMY pool on the cadence", () => {
  let s = withRelays([0, 0, 0, 1]); // A holds 3 of 4 = majority
  for (let i = 0; i < 40; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.tickets[0], 20, "the majority holder keeps its pool");
  assert.ok(s.tickets[1] <= 16, `enemy pool bled: ${s.tickets[1]}`);
});

test("13H: no majority, no bleed", () => {
  let s = withRelays([0, 0, 1, 1]); // 2-2 split under majority 3
  for (let i = 0; i < 40; i++) s = apply(s, { type: "advance_tick" });
  assert.deepEqual(s.tickets, [20, 20]);
});

test("13H: an empty pool loses the war with WIN_TICKETS", () => {
  let s = withRelays([0, 0, 0, 0], { pool: 3 });
  let over = null;
  for (let i = 0; i < 400 && !over; i++) {
    s = apply(s, { type: "advance_tick" });
    over = s.events.find((e) => e.type === "game_over") ?? null;
  }
  assert.ok(over, "war ends when the pool drains");
  assert.equal(over.reason, WIN_TICKETS);
  assert.equal(over.winner, 0, "the bleeder wins");
});

test("13H: pools are session law — rules carry them, defaults are pinned", () => {
  assert.equal(DEFAULT_RULES.ticketPool, 300);
  assert.equal(DEFAULT_RULES.ticketBleedTicks, 20);
  assert.equal(DEFAULT_RULES.ticketMajority, 5);
  const s = createInitialState(42, "frontier_corridor", { ticketPool: 77 });
  assert.deepEqual(s.tickets, [77, 77]);
});

test("13H: tickets are hashed state", async () => {
  const { hashState } = await import("../engine/snapshot.js");
  const a = createInitialState(42, "frontier_corridor");
  const b = createInitialState(42, "frontier_corridor");
  b.tickets = [b.tickets[0] - 1, b.tickets[1]];
  assert.notEqual(hashState(a), hashState(b));
});
