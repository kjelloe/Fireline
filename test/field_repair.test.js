// test/field_repair.test.js — playtest-9 item 32, ruled: a truck with
// materiel patches an adjacent LIVING friendly up to HALF hull.
//
// The cap is the whole design. B1 made recovery ticket-relevant, so an
// uncapped field repair would have quietly deleted the tow economy: a
// wreck must still go home, and a hull already above half gets nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, RECOG_FIELD_REPAIR } from "../engine/reducer.js";
import { restoredHp } from "../engine/recovery.js";
import { getUnitStats } from "../engine/units.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const UNIT_TANK = 0, UNIT_TRUCK = 3;
const ASSET_DISABLED = 2;
const HALF_TANK = restoredHp(UNIT_TANK);

// A truck with a materiel load beside a damaged tank.
function field(tankHp, opts = {}) {
  let s = sandbox([
    { team: 0, type: UNIT_TRUCK, cellX: 20, cellY: 20, materiel: 1 },
    { team: opts.team ?? 0, type: UNIT_TANK, cellX: 21, cellY: 20, hp: tankHp,
      ...(opts.wreck ? { state: ASSET_DISABLED } : {}) },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  return apply(s, { type: "advance_tick" });
}

test("32: a mauled hull is patched up to HALF, and the load is spent", () => {
  const s = field(10);
  assert.equal(s.assets[1].hp, HALF_TANK, "patched to half hull");
  assert.equal(s.assets[0].materiel, 0, "the materiel load was consumed");
  const ev = s.events.find((e) => e.type === "asset_field_repaired");
  assert.ok(ev, "the repair announces itself");
  assert.equal(ev.healed, HALF_TANK - 10);
});

test("32: the CAP holds — a hull above half gets nothing", () => {
  const healthy = HALF_TANK + 5;
  const s = field(healthy);
  assert.equal(s.assets[1].hp, healthy, "not touched");
  assert.equal(s.assets[0].materiel, 1, "and no load wasted");
  assert.ok(!s.events.some((e) => e.type === "asset_field_repaired"));
});

test("32: a WRECK still needs the bay — field repair cannot raise the dead", () => {
  // This is what protects B1's recovery economy.
  const s = field(0, { wreck: true });
  assert.equal(s.assets[1].state, ASSET_DISABLED, "still a wreck");
  assert.equal(s.assets[1].hp, 0, "field repair does not resurrect it");
  assert.equal(s.assets[0].materiel, 1, "the truck keeps its load for a real job");
});

test("32: enemies are not patched", () => {
  const s = field(10, { team: 1 });
  assert.equal(s.assets[1].hp, 10, "we do not repair the other side");
  assert.equal(s.assets[0].materiel, 1);
});

test("32: the repairing operator earns Recognition, below a tow", () => {
  const s = field(10);
  const op = s.operators[0];
  assert.equal(op.score, RECOG_FIELD_REPAIR, "credited for the patch");
  assert.ok(RECOG_FIELD_REPAIR < 8, "and it is worth less than recovering a wreck");
});

test("32: only a cargo chassis repairs, and never itself", () => {
  // A lone damaged truck carrying materiel must not heal itself.
  let s = sandbox([{ team: 0, type: UNIT_TRUCK, cellX: 20, cellY: 20, materiel: 1, hp: 5 }]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].hp, 5, "no self-service");
  assert.ok(s.assets[0].materiel === 1 || s.assets[0].materiel === 0,
    "materiel may reload at base, but nothing was repaired");
  assert.ok(!s.events.some((e) => e.type === "asset_field_repaired"));

  // A tank carrying nothing repairs nobody.
  let t = sandbox([
    { team: 0, type: UNIT_TANK, cellX: 20, cellY: 20 },
    { team: 0, type: UNIT_TANK, cellX: 21, cellY: 20, hp: 10 },
  ]);
  t = joinAndSelect(t, 0, 0, 0);
  t = apply(t, { type: "advance_tick" });
  assert.equal(t.assets[1].hp, 10, "tanks are not field workshops");
});

test("32: chassis maxima are respected — half means half of THAT hull", () => {
  for (const type of [UNIT_TANK, 1 /* scout */, 2 /* artillery */]) {
    assert.equal(restoredHp(type), Math.floor(getUnitStats(type).hp / 2),
      "the cap tracks each chassis, not a global number");
  }
});
