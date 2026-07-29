// test/war_metrics.test.js — the sweep instrument itself (prompt 88).
// An untested instrument is how a broken mirror transform survived long
// enough to manufacture a month of false side-leans, so the collector
// gets the same discipline as the engine: synthetic wars with known
// answers, then one real war to prove the wiring.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createWarMetrics, METRIC_COLUMNS } from "../tools/war_metrics.mjs";
import { GameServer } from "../engine/server.js";

// A minimal fake state the collector can read.
function fake(tickets, opts = {}) {
  return {
    tickets,
    phase: opts.phase ?? 0,
    winner: opts.winner,
    sites: opts.sites ?? [],
    rules: opts.rules ?? { ticketMajority: 5 },
    events: opts.events ?? [],
  };
}

test("88: lead changes count sign FLIPS, not level pools", () => {
  const w = createWarMetrics();
  for (const t of [[300, 300], [299, 300], [299, 298], [297, 298], [250, 250], [249, 250]]) {
    w.observe(fake(t));
  }
  // behind -> ahead -> behind = two crossings; the level pools between
  // them are not changes.
  assert.equal(w.finish(fake([249, 250], { winner: 1 })).leadChanges, 2);
});

test("88: the winner's max deficit is the comeback measure", () => {
  const w = createWarMetrics();
  w.observe(fake([300, 300]));
  w.observe(fake([220, 300])); // team 0 is 80 down
  w.observe(fake([220, 100])); // and storms back
  const out = w.finish(fake([220, 0], { winner: 0 }));
  assert.equal(out.winnerMaxDeficit, 80, "the hole team 0 climbed out of");
  assert.equal(out.winnerMargin, 220, "and what they had left at the end");
});

test("88: majority flips track the bleed threshold, not raw ownership", () => {
  const sites = (a, b) => [
    ...Array.from({ length: a }, (_, i) => ({ id: i, owner: 0 })),
    ...Array.from({ length: b }, (_, i) => ({ id: 10 + i, owner: 1 })),
    { id: 99, owner: -1 },
  ];
  const w = createWarMetrics();
  w.observe(fake([300, 300], { sites: sites(5, 2) })); // A holds majority (5 of 8 law)
  w.observe(fake([300, 300], { sites: sites(3, 4) })); // nobody does
  w.observe(fake([300, 300], { sites: sites(2, 5) })); // B takes it
  w.observe(fake([300, 300], { sites: sites(5, 2) })); // A takes it back
  assert.equal(w.finish(fake([300, 300], { winner: -1 })).majorityFlips, 2,
    "A->B and B->A; the no-majority gap between them is not a flip");
});

test("88: mercy bleeds and overtime are visible in the pools alone", () => {
  const w = createWarMetrics();
  w.observe(fake([300, 60]));
  w.observe(fake([300, 57])); // -3 in one tick = the mercy rate
  w.observe(fake([300, 57]));
  w.observe(fake([300, 5]));  // a -52 collapse is NOT mercy (bigger than the rate)
  w.observe(fake([300, 0]));  // pool empty...
  w.observe(fake([300, 0]));  // ...but the war is still phase 0: overtime
  const out = w.finish(fake([300, 0], { winner: 0 }));
  assert.equal(out.mercyBleeds, 1);
  assert.ok(out.overtimeTicks >= 2, "ticks survived past an empty pool");
});

test("88: standard attempts and scores are counted from events", () => {
  const w = createWarMetrics();
  w.observe(fake([300, 300], { events: [{ type: "standard_taken" }] }));
  w.observe(fake([300, 300], { events: [{ type: "standard_taken" }, { type: "standard_scored" }] }));
  const out = w.finish(fake([300, 300], { winner: 0 }));
  assert.equal(out.stdAttempts, 2, "two runs were started");
  assert.equal(out.stdScored, 1, "one came home");
});

test("88: column list and collector output cannot drift apart", () => {
  const out = createWarMetrics().finish(fake([300, 300], { winner: -1 }));
  assert.deepEqual(Object.keys(out).sort(), [...METRIC_COLUMNS].sort(),
    "every column has a value and every value has a column");
});

test("88: a real war produces sane numbers end to end", () => {
  const war = new GameServer({ mapSeed: 2026, enableAi: true, aiDifficulty: 1 });
  const w = createWarMetrics();
  for (let i = 0; i < 3000 && war.state.phase === 0; i++) {
    war.step();
    w.observe(war.state);
  }
  const out = w.finish(war.state);
  for (const col of METRIC_COLUMNS) {
    assert.ok(Number.isInteger(out[col]), `${col} is an integer (got ${out[col]})`);
  }
  assert.ok(out.majorityFlips >= 0 && out.leadChanges >= 0);
});
