// test/carrier_passengers.test.js — playtest-9 item 35, the stranding.
//
// A player whose carrier died respawned ABOARD another carrier (15F).
// That carrier was then destroyed — and nothing in the engine released
// its passengers. They stayed marked aboard a WRECK forever: "centre on
// me" pointed at the hulk, and they could never take another asset.
// The crew bailed out, the tow was released, the standard was dropped;
// the passengers were simply forgotten.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const OP_ACTIVE = 1, OP_DOWN = 2;
const ASSET_DISABLED = 2;
const UNIT_CARRIER = 4;

// A carrier with two riders, and an enemy gun one cell away.
function loadedCarrier() {
  let s = sandbox([
    { team: 0, type: UNIT_CARRIER, cellX: 20, cellY: 20, hp: 1 },
    { team: 1, type: 0, cellX: 22, cellY: 20, ammo: 20 },
  ]);
  s.assets[0].aboard1 = 5;
  s.assets[0].aboard2 = 6;
  for (const id of [5, 6]) {
    s.operators[id].state = OP_ACTIVE;
    s.operators[id].team = 0;
    s.operators[id].assetId = -1;
  }
  s = joinAndSelect(s, 0, 1, 1); // the enemy gunner
  return s;
}

test("35: a destroyed carrier puts its passengers ON FOOT, not in limbo", () => {
  let s = loadedCarrier();
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 0 });

  const wreck = s.assets[0];
  assert.equal(wreck.state, ASSET_DISABLED, "the carrier died");
  assert.equal(wreck.aboard1, -1, "seat 1 released");
  assert.equal(wreck.aboard2, -1, "seat 2 released");

  for (const id of [5, 6]) {
    assert.equal(s.operators[id].state, OP_DOWN, `operator ${id} is on foot`);
    assert.equal(s.operators[id].assetId, -1);
    assert.ok(s.downed.some((d) => d.operatorId === id),
      `operator ${id} has a downed entity to crawl with`);
    assert.ok(s.events.some((e) => e.type === "operator_downed" && e.operatorId === id));
  }
});

test("35: a released passenger can take a new asset (the stranding itself)", () => {
  let s = loadedCarrier();
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 0 });
  // On foot they must redeploy first (the normal down flow), and then
  // crewing something new has to work — that is what "could not claim
  // another asset" was.
  const down = s.downed.find((d) => d.operatorId === 5);
  down.downTicks = 200; // past the redeploy gate
  s = apply(s, { type: "redeploy", operatorId: 5 });
  assert.equal(s.operators[5].state, OP_ACTIVE, "redeploy returns the seat");
  assert.ok(!s.assets.some((a) => a.aboard1 === 5 || a.aboard2 === 5),
    "and nothing still lists them as a passenger");
});

test("35: a live carrier still carries — the fix only fires on a wreck", () => {
  let s = loadedCarrier();
  s.assets[0].hp = 100; // survives the shot
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 0 });
  assert.notEqual(s.assets[0].state, ASSET_DISABLED);
  assert.equal(s.assets[0].aboard1, 5, "passengers stay aboard a living carrier");
  assert.equal(s.assets[0].aboard2, 6);
  assert.equal(s.operators[5].state, OP_ACTIVE, "and are not dumped on foot");
});
