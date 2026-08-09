// test/carrier_passengers.test.js — playtest-9 item 35, the stranding —
// REWRITTEN for prompt 219, the stranding's second life.
//
// A player whose carrier died respawned ABOARD another carrier (15F).
// That carrier was then destroyed — and the passengers were left in
// limbo. The playtest-9 fix released riders only when state === OP_ACTIVE,
// but REAL riders are OP_DOWN while aboard (board_carrier requires it,
// rescue and 15F never change it; only base delivery activates). So the
// release cleared the seat slot and then skipped the operator: down,
// bodyless, aboard nothing — redeploy says "not downed", select says
// "operator not active", forever. The original test never caught it
// because it built riders surgically with OP_ACTIVE — a state the engine
// never produces. These tests board through the REAL machinery only.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { createDowned } from "../engine/downed.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const OP_ACTIVE = 1, OP_DOWN = 2;
const ASSET_DISABLED = 2;
const UNIT_CARRIER = 4;

// A crewed carrier with two riders boarded via the real board_carrier
// command, and an enemy gun one cell away.
function loadedCarrier() {
  let s = sandbox([
    { team: 0, type: UNIT_CARRIER, cellX: 20, cellY: 20, hp: 1 },
    { team: 1, type: 0, cellX: 22, cellY: 20, ammo: 20 },
  ]);
  s = joinAndSelect(s, 0, 1, 1); // the enemy gunner
  for (const id of [5, 6]) {
    const seat = s.operators[id];
    seat.state = OP_DOWN;
    seat.team = 0;
    seat.assetId = -1;
    s.downed.push(createDowned(seat, s.assets[0])); // on foot beside the carrier
    s = apply(s, { type: "board_carrier", operatorId: id, carrierAssetId: 0 });
    assert.ok(s.assets[0].aboard1 === id || s.assets[0].aboard2 === id,
      `operator ${id} actually boarded`);
  }
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
  assert.ok(down, "released rider has a body to redeploy from");
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
  const riders = [s.assets[0].aboard1, s.assets[0].aboard2].sort();
  assert.deepEqual(riders, [5, 6], "passengers stay aboard a living carrier");
  assert.ok(!s.downed.some((d) => d.operatorId === 5 || d.operatorId === 6),
    "and are not dumped on foot");
});

// Prompt 219, the reported sequence verbatim: shot down → 15F respawn
// aboard a carrier → that carrier shot too → the seat must come out on
// foot and be redeployable, never a bodyless ghost.
test("219: a 15F carrier-spawned rider survives the carrier's death on foot", () => {
  let s = sandbox([
    { team: 0, type: UNIT_CARRIER, cellX: 20, cellY: 20, hp: 1 },
    { team: 1, type: 0, cellX: 22, cellY: 20, ammo: 20 },
  ]);
  s = joinAndSelect(s, 0, 1, 1); // the enemy gunner
  s = joinAndSelect(s, 1, 0, 0); // 15F requires a crewed carrier
  const seat = s.operators[5];
  seat.state = OP_DOWN;
  seat.team = 0;
  seat.assetId = -1;
  const body = createDowned(seat, s.assets[1]); // downed far from the carrier
  body.downTicks = 200; // past the redeploy gate
  s.downed.push(body);
  s = apply(s, { type: "redeploy", operatorId: 5, carrierAssetId: 0 });
  assert.ok(s.events.some((e) => e.type === "operator_carrier_spawned" && e.operatorId === 5),
    "the field respawn itself worked");

  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 0 });
  assert.equal(s.assets[0].state, ASSET_DISABLED, "the second carrier died too");
  assert.equal(s.operators[5].state, OP_DOWN, "the rider is on foot, not a ghost");
  const reDown = s.downed.find((d) => d.operatorId === 5);
  assert.ok(reDown, "with a body to crawl with");
  reDown.downTicks = 200;
  s = apply(s, { type: "redeploy", operatorId: 5 });
  assert.equal(s.operators[5].state, OP_ACTIVE, "and the seat comes back");
});
