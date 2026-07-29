// test/meaningful_deaths.test.js — B1 (designer eval #35): a wreck costs
// the owning team a ticket, and recovering it gives the ticket back.
// Deaths used to be free, which left the rescue economy thematically
// central but mechanically optional.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../engine/state.js";
import { apply } from "../engine/reducer.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const ASSET_DISABLED = 2;

// A one-shot kill: put a gun next to a nearly-dead enemy and fire.
function duel(opts = {}) {
  let s = sandbox([
    { team: 0, type: 0, cellX: 20, cellY: 20, ammo: 20 },
    { team: 1, type: 0, cellX: 22, cellY: 20, hp: 1 },
  ]);
  s.tickets = opts.tickets ?? [300, 300];
  if (opts.rules) s.rules = { ...s.rules, ...opts.rules };
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  return s;
}

test("B1: a disable costs the OWNER a ticket, and only the owner", () => {
  const s = duel();
  assert.equal(s.assets[1].state, ASSET_DISABLED, "the target is a wreck");
  assert.deepEqual(s.tickets, [300, 299],
    "team B lost the hull, so team B pays — the killer's pool is untouched");
});

test("B1: recovering the wreck refunds the ticket — the tow pays for itself", () => {
  let s = duel();
  assert.deepEqual(s.tickets, [300, 299]);
  // Drive the recovery directly: the repair bay is what refunds, and its
  // timer is the same one the tow-home path hands off to.
  const wreck = s.assets[1];
  wreck.recoverTimer = 1;
  s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some((e) => e.type === "asset_restored" && e.assetId === 1));
  assert.deepEqual(s.tickets, [300, 300], "the ticket came back with the hull");
});

test("B1: the pool never goes negative and a refund never mints tickets", () => {
  const s = duel({ tickets: [300, 0] });
  assert.deepEqual(s.tickets, [300, 0], "an empty pool cannot go below zero");

  // A refund above the starting pool would be free money.
  let t = sandbox([{ team: 0, type: 0, cellX: 20, cellY: 20, state: ASSET_DISABLED, hp: 0 }]);
  t.tickets = [t.rules.ticketPool, t.rules.ticketPool]; // AT the cap, whatever the session pool is
  t.assets[0].recoverTimer = 1;
  t = apply(t, { type: "advance_tick" });
  assert.equal(t.tickets[0], t.rules.ticketPool, "capped at the starting pool");
});

test("B1: ticketPerDisable 0 restores the pre-B1 world (deaths are free)", () => {
  const s = duel({ rules: { ticketPerDisable: 0 } });
  assert.equal(s.assets[1].state, ASSET_DISABLED);
  assert.deepEqual(s.tickets, [300, 300], "the lever turns the whole feature off");
});

test("B1: an ABANDONED hull costs the same ticket, so the ledger cannot be gamed", () => {
  // Charging only combat deaths would let a team abandon a hull for free,
  // tow it home, and bank a refund for a ticket nobody ever paid.
  let s = createInitialState(2026, "frontier_corridor");
  const asset = s.assets[0];
  asset.operatorId = -1;
  asset.x = 60 * 256; // out in the field, not safe at home
  asset.y = 63 * 256;
  asset.abandonTimer = 599; // one tick short of the recall
  const before = [...s.tickets];
  s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some((e) => e.type === "asset_recalled" && e.assetId === 0),
    "the hull self-wrecked");
  assert.equal(s.tickets[0], before[0] - 1, "and it cost a ticket like any other wreck");
});
