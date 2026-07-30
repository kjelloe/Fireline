// test/mercy_overtime.test.js — B3: the two endgame rules.
//
// MERCY: the tail of a decided war, where the result is settled and the
// clock just grinds. The leader holds the majority, the loser's pool is
// nearly gone, so the bleed accelerates and the drag ends — but it
// relents the instant the losing side starts a capture, so fighting your
// way out is never punished.
//
// (The designer's wording was "full cap held 3 minutes". That is
// UNREACHABLE here: holding every site already wins outright after 300
// ticks, so such a war would have ended six times over. The rule is
// aimed at the same drag by a reachable trigger.)
//
// OVERTIME: an empty pool does not end the war while the losing side
// still has a play live. A war decided mid-capture is a photo finish
// stolen by a clock.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { checkVictory, WIN_TICKETS } from "../engine/victory.js";
import { sandbox } from "./helpers.js";

// Team 0 holds every site; team 1 is trapped.
function trap(opts = {}) {
  // THREE sites, so a majority (2 of 3) can exist WITHOUT a full cap —
  // with two sites the only majority is both, which trips the domination
  // win instead and the war never reaches the drag this rule is for.
  // A team-1 unit optionally STANDS on the third (neutral) site, so the
  // capture is real: the reducer's capture pass recomputes capturingTeam
  // from presence every tick, so simply setting the field is fiction.
  const units = [{ team: 0, type: 0, cellX: 30, cellY: 30 }];
  if (opts.capturing) units.push({ team: 1, type: 0, cellX: 50, cellY: 50 });
  let s = sandbox(units,
    [{ cellX: 30, cellY: 30, owner: 0 },
     { cellX: 40, cellY: 40, owner: 0 },
     { cellX: 50, cellY: 50, owner: -1 }]
  );
  s.tickets = [300, opts.loserPool ?? 300];
  return s;
}

// Advance to the next bleed boundary and report what team 1 lost.
function bleedOnce(s) {
  const before = s.tickets[1];
  for (let i = 0; i < 25; i++) {
    s = apply(s, { type: "advance_tick" });
    if (s.tickets[1] !== before) break;
  }
  return before - s.tickets[1];
}

test("B3 mercy: a normal majority bleeds ONE ticket per cadence", () => {
  const lost = bleedOnce(trap({ loserPool: 300 }));
  assert.equal(lost, 1, "not yet a spawn trap, so the normal rate applies");
});

test("B3 mercy: a nearly-empty pool ACCELERATES the bleed", () => {
  const lost = bleedOnce(trap({ loserPool: 50 })); // under pool/4
  assert.equal(lost, 3, "the drag is ended deliberately, not slowly");
});

test("B3 mercy RELENTS the moment the losing side starts a capture", () => {
  // Same hopeless pool, but team 1 is now fighting for a flag.
  const lost = bleedOnce(trap({ loserPool: 50, capturing: true }));
  assert.equal(lost, 1, "a team fighting its way out is not punished for it");
});

test("B3 overtime: an empty pool does NOT end the war mid-capture", () => {
  let s = trap({ loserPool: 0, capturing: true });
  s = apply(s, { type: "advance_tick" }); // let the capture pass register it
  const v = checkVictory(s);
  assert.ok(!(v && v.reason === WIN_TICKETS && v.winner === 0),
    "the capture resolves before the clock does");
});

test("B3 overtime: with nothing live, an empty pool ends it immediately", () => {
  let s = trap({ loserPool: 0 });
  const v = checkVictory(s);
  assert.ok(v && v.winner === 0 && v.reason === WIN_TICKETS,
    "no play live, so the war is over");
});

test("B3 overtime can be switched OFF by session rules", () => {
  let s = trap({ loserPool: 0, capturing: true });
  s = apply(s, { type: "advance_tick" });
  s.rules = { ...s.rules, overtime: false };
  const v = checkVictory(s);
  assert.ok(v && v.winner === 0, "the hard cutoff is restorable");
});

test("B3: neither rule fires in an ordinary war", () => {
  // The common case must be untouched: no full cap, pools healthy.
  let s = sandbox(
    [{ team: 0, type: 0, cellX: 30, cellY: 30 }],
    [{ cellX: 30, cellY: 30, owner: 0 }, { cellX: 40, cellY: 40, owner: 1 }]
  );
  s.tickets = [300, 300];
  for (let i = 0; i < 40; i++) s = apply(s, { type: "advance_tick" });
  assert.deepEqual(s.tickets, [300, 300], "a split map bleeds nobody");
  assert.equal(checkVictory(s), null, "and nobody wins");
});

test("Q25 rout condition: two teams scraping bottom get their photo finish", () => {
  // Loser nearly out BUT the leader is poor too (no 2x ratio): normal rate.
  let s = trap({ loserPool: 50 });
  s.tickets = [90, 50]; // 90 < 100 = no rout
  const lost = bleedOnce(s);
  assert.equal(lost, 1, "a close endgame is never mercy-accelerated");
});
