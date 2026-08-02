// test/heart_bleed.test.js — riverline pacing (prompt 136): the bridge
// pair is the map's declared HEART; owning every heart relay is
// bleed-equivalent to the ticket majority (the crossing is the supply
// line). Other profiles declare no hearts and are untouched.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, createInitialState } from "../engine/reducer.js";
import { MAP_LAYOUTS } from "../engine/state.js";

function riverlineWar(owners) {
  // handicap:false — these tests pin BLEED mechanics on symmetric
  // pools; the D+C measured offset (prompt 154) is its own suite.
  const s = createInitialState(2026, "riverline", { handicap: false });
  for (const [id, owner] of Object.entries(owners)) s.sites[Number(id)].owner = owner;
  return s;
}

function tick(s, n) {
  for (let i = 0; i < n; i++) s = apply(s, { type: "advance_tick" });
  return s;
}

test("heart: riverline declares the bridge pair, and it mirrors exactly", () => {
  const hearts = MAP_LAYOUTS.riverline.heartSiteIds;
  assert.deepEqual([...hearts], [4, 5]);
  const cells = hearts.map((id) => MAP_LAYOUTS.riverline.relayCells[id]);
  assert.equal(127 - cells[0].cellX, cells[1].cellX, "x-mirror pair");
  assert.equal(cells[0].cellY, cells[1].cellY, "same row");
  for (const name of Object.keys(MAP_LAYOUTS)) {
    if (name === "riverline") continue;
    assert.equal(MAP_LAYOUTS[name].heartSiteIds, undefined,
      `${name} declares no hearts`);
  }
});

test("heart: owning both bridge relays bleeds the enemy at 2 sites held", () => {
  let s = riverlineWar({ 4: 0, 5: 0 }); // under majority 4, hearts held
  const before = s.tickets[1];
  s = tick(s, 45); // two bleed cadences at default 20
  assert.equal(s.tickets[0], before, "heart holder keeps its pool");
  assert.ok(s.tickets[1] <= before - 2, `enemy bled: ${s.tickets[1]}/${before}`);
});

test("heart: two non-heart relays do NOT bleed", () => {
  let s = riverlineWar({ 0: 0, 2: 0 });
  const before = s.tickets[1];
  s = tick(s, 45);
  assert.equal(s.tickets[1], before);
  assert.equal(s.tickets[0], before);
});

test("heart: a split pair does NOT bleed", () => {
  let s = riverlineWar({ 4: 0, 5: 1 });
  const before = s.tickets[0];
  s = tick(s, 45);
  assert.deepEqual(s.tickets, [before, before]);
});

test("heart: outer sweep vs crossing hold bleed EACH OTHER", () => {
  // A owns all four outer relays (majority 4); B owns the crossing.
  let s = riverlineWar({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 });
  const before = s.tickets[0];
  s = tick(s, 45);
  assert.ok(s.tickets[0] <= before - 2, "the crossing bleeds A");
  assert.ok(s.tickets[1] <= before - 2, "the majority bleeds B");
});

test("stalemate: joined war under majority grinds BOTH pools (riverline)", () => {
  let s = riverlineWar({ 0: 0, 1: 1 }); // one relay each — joined, no majority
  const before = s.tickets[0];
  s = tick(s, 101); // two stalemate cadences at layout 50
  assert.ok(s.tickets[0] <= before - 2, `A ground down: ${s.tickets[0]}`);
  assert.ok(s.tickets[1] <= before - 2, `B ground down: ${s.tickets[1]}`);
});

test("stalemate: an unjoined war (all relays neutral) pays nothing", () => {
  let s = riverlineWar({});
  const before = s.tickets[0];
  s = tick(s, 101);
  assert.deepEqual(s.tickets, [before, before]);
});

test("stalemate: frontier declares no cadence and never grinds", () => {
  let s = createInitialState(2026, "frontier_corridor", {});
  s.sites[0].owner = 0;
  s.sites[1].owner = 1;
  const before = s.tickets[0];
  s = tick(s, 101);
  assert.deepEqual(s.tickets, [before, before]);
});

test("overtime cap: a live capture holds an empty pool open only 600 ticks", async () => {
  const { checkVictory, WIN_TICKETS } = await import("../engine/victory.js");
  const s = riverlineWar({ 4: 0 });
  s.tickets = [5, 0];
  s.sites[5].capturingTeam = 1; // the losing side's play is live
  s.overtime = 600;
  assert.equal(checkVictory(s), null, "inside the window overtime holds");
  s.overtime = 601;
  const v = checkVictory(s);
  assert.ok(v && v.reason === WIN_TICKETS && v.winner === 0,
    "past the cap the empty pool ends the war");
});

test("overtime cap: the reducer counts held-open ticks (hashed)", () => {
  let s = riverlineWar({});
  s.tickets = [5, 0];
  assert.equal(s.overtime, 0);
  s = tick(s, 3); // war ends by tickets on the first tick — one count
  assert.ok(s.overtime >= 1, `counter runs: ${s.overtime}`);
});

test("stalemate: MODE wars never grind (mission suspends all bleed)", () => {
  let s = createInitialState(2026, "riverline", { mode: 1, modeAttacker: 0, handicap: false });
  assert.ok(s.mission, "convoy mission is live");
  s.sites[0].owner = 0;
  s.sites[1].owner = 1;
  const before = s.tickets[0];
  s = tick(s, 101);
  assert.deepEqual(s.tickets, [before, before]);
});
