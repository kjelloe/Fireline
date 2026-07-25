// test/milestone1j.test.js — Milestone 1J: ammo/fuel supply + base resupply.
// Ported to the authoritative engine. Covers the six acceptance criteria in
// phases/phase1/plan.md plus reconstruction self-tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import {
  AMMO_MAX, FUEL_MAX, SUPPLY_FIRE_COST, SUPPLY_MOVE_COST, resupplyAt, inOwnBase,
} from "../engine/supply.js";
import { ASSET_MOVING } from "../engine/state.js";
import { buildView } from "../engine/view.js";
import { sandbox, joinAndSelect, joinSelectMove } from "./helpers.js";

const HOME_BASE = [{ team: 0, x: 0, y: 0, width: 4, height: 4 }];

test("1J firing deducts ammo by SUPPLY_FIRE_COST", () => {
  let s = sandbox([
    { team: 0, cellX: 10 },
    { team: 1, cellX: 12 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.assets[0].ammo, AMMO_MAX - SUPPLY_FIRE_COST);
});

test("1J asset with ammo=0 cannot fire", () => {
  let s = sandbox([
    { team: 0, cellX: 10, ammo: 0 },
    { team: 1, cellX: 12 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.deepEqual(s.events, [
    { type: "rejected", cmd: "fire_order", reason: "out of ammo" },
  ]);
  assert.equal(s.assets[1].hp, 100);
});

test("1J moving deducts fuel by SUPPLY_MOVE_COST per tick", () => {
  let s = sandbox([{ team: 0, cellX: 10 }]);
  s = joinSelectMove(s, 0, 0, 0, 20, 0);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].fuel, FUEL_MAX - SUPPLY_MOVE_COST);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].fuel, FUEL_MAX - 2 * SUPPLY_MOVE_COST);
});

test("1J asset with fuel=0 is stranded", () => {
  let s = sandbox([{ team: 0, cellX: 10, fuel: 0, state: ASSET_MOVING, targetX: 5000 }]);
  const before = s.assets[0].x;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].x, before, "no fuel, no movement");
});

test("1J asset at home base is resupplied", () => {
  let s = sandbox(
    [{ team: 0, cellX: 1, cellY: 1, ammo: 2, fuel: 100 }],
    [],
    { bases: HOME_BASE }
  );
  assert.equal(inOwnBase(s, s.assets[0]), true);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].ammo, AMMO_MAX);
  assert.equal(s.assets[0].fuel, FUEL_MAX);
  assert.deepEqual(s.events, [{ type: "resupplied", assetId: 0 }]);
});

test("1J view reports correct ammo and fuel for own assets", () => {
  const s = sandbox([{ team: 0, cellX: 1, ammo: 3, fuel: 42 }]);
  const own = buildView(s, 0).friendlyAssets[0];
  assert.equal(own.ammo, 3);
  assert.equal(own.fuel, 42);
});

test("1J enemy asset supply fields are hidden in view", () => {
  const s = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: 2, ammo: 3, fuel: 42 },
  ]);
  const enemy = buildView(s, 0).visibleEnemies[0];
  assert.equal("ammo" in enemy, false);
  assert.equal("fuel" in enemy, false);
});

// ── additional 1J self-tests ──────────────────────────────────────────────────

test("1J transiting your base while moving does not resupply", () => {
  let s = sandbox(
    [{ team: 0, cellX: 1, cellY: 1, ammo: 2, state: ASSET_MOVING, targetX: 5000 }],
    [],
    { bases: HOME_BASE }
  );
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].ammo, 2, "moving assets do not resupply");
  assert.equal(s.events.length, 0);
});

test("1J enemy base does not resupply visitors", () => {
  const s = sandbox(
    [{ team: 1, cellX: 1, cellY: 1, ammo: 0 }],
    [],
    { bases: HOME_BASE } // base belongs to team 0
  );
  assert.equal(resupplyAt(s, 0), null);
});

test("1J resupply event fires once, not while already full", () => {
  let s = sandbox(
    [{ team: 0, cellX: 1, cellY: 1, ammo: 2 }],
    [],
    { bases: HOME_BASE }
  );
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.events.length, 1);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.events.length, 0, "no repeat resupply while full");
});

test("1J out of ammo asset regains combat ability after base visit", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 1, cellY: 1, ammo: 0 },
      { team: 1, cellX: 3, cellY: 1 },
    ],
    [],
    { bases: HOME_BASE }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.events[0].type, "rejected");
  s = apply(s, { type: "advance_tick" }); // resupply at base
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.events[0].type, "fire_resolved");
});
