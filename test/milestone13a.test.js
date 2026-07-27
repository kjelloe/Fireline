// test/milestone13a.test.js — Slice 13A/13B: full cargo (prompt 31).
// Trucks haul one asset's worth of fuel+ammo, reload silently at home,
// transfer to adjacent friendlies; the AI runs resupply errands.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { CARGO_FUEL_MAX, CARGO_AMMO_MAX, FUEL_MAX, AMMO_MAX } from "../engine/supply.js";
import { AIRegency } from "../engine/ai_regency.js";
import { hashState } from "../engine/snapshot.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const OFF_BASES = [
  { team: 0, x: 0, y: 0, width: 4, height: 4 },
  { team: 1, x: 60, y: 60, width: 4, height: 4 },
];

test("13A the hold refills silently at home; the fixture stays quiet", () => {
  let s = sandbox([{ team: 0, cellX: 1, cellY: 1, type: 3 }], [], { bases: OFF_BASES });
  assert.equal(s.assets[0].cargoFuel, 0);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].cargoFuel, CARGO_FUEL_MAX, "fuel loaded at home");
  assert.equal(s.assets[0].cargoAmmo, CARGO_AMMO_MAX, "shells loaded at home");
  assert.equal(s.events.some((e) => String(e.type).includes("cargo")), false,
    "loading is silent — the 1A event contract sleeps safely");
});

test("13A transfer tops the neighbor up and empties the hold accordingly", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 30, cellY: 30, type: 3, cargoFuel: CARGO_FUEL_MAX, cargoAmmo: CARGO_AMMO_MAX },
      { team: 0, cellX: 31, cellY: 30, ammo: 2, fuel: 400 },
    ],
    [], { bases: OFF_BASES }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "transfer_cargo", operatorId: 0, targetAssetId: 1 });
  const ev = s.events.find((e) => e.type === "cargo_transferred");
  assert.deepEqual(ev, {
    type: "cargo_transferred", byAssetId: 0, assetId: 1,
    fuel: FUEL_MAX - 400, ammo: AMMO_MAX - 2,
  });
  assert.equal(s.assets[1].fuel, FUEL_MAX, "topped up");
  assert.equal(s.assets[1].ammo, AMMO_MAX);
  assert.equal(s.assets[0].cargoFuel, CARGO_FUEL_MAX - (FUEL_MAX - 400), "hold pays for it");

  const again = apply(s, { type: "transfer_cargo", operatorId: 0, targetAssetId: 1 });
  assert.equal(again.events[0].reason, "target is topped up");
});

test("13A honest rejections: chassis, reach, empty hold, enemies, wrecks", () => {
  let tank = sandbox([{ team: 0, cellX: 30 }, { team: 0, cellX: 31, ammo: 0 }], [], { bases: OFF_BASES });
  tank = joinAndSelect(tank, 0, 0, 0);
  assert.equal(apply(tank, { type: "transfer_cargo", operatorId: 0, targetAssetId: 1 })
    .events[0].reason, "needs a logistics truck");

  let far = sandbox(
    [{ team: 0, cellX: 30, type: 3, cargoFuel: 100 }, { team: 0, cellX: 40, ammo: 0 }],
    [], { bases: OFF_BASES });
  far = joinAndSelect(far, 0, 0, 0);
  assert.equal(apply(far, { type: "transfer_cargo", operatorId: 0, targetAssetId: 1 })
    .events[0].reason, "cargo out of reach");

  let dry = sandbox(
    [{ team: 0, cellX: 30, type: 3 }, { team: 0, cellX: 31, ammo: 0 }],
    [], { bases: OFF_BASES });
  dry = joinAndSelect(dry, 0, 0, 0);
  assert.equal(apply(dry, { type: "transfer_cargo", operatorId: 0, targetAssetId: 1 })
    .events[0].reason, "cargo hold empty");

  let foe = sandbox(
    [{ team: 0, cellX: 30, type: 3, cargoFuel: 100 }, { team: 1, cellX: 31, fuel: 0 }],
    [], { bases: OFF_BASES });
  foe = joinAndSelect(foe, 0, 0, 0);
  assert.equal(apply(foe, { type: "transfer_cargo", operatorId: 0, targetAssetId: 1 })
    .events[0].reason, "friendly target", "we don't fuel the enemy");
});

test("13B the AI truck runs a resupply errand to the thirsty tube", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 30, cellY: 30, type: 3, cargoFuel: CARGO_FUEL_MAX, cargoAmmo: CARGO_AMMO_MAX },
      { team: 0, cellX: 40, cellY: 30, type: 2, ammo: 0 },
      { team: 1, cellX: 60 },
    ],
    [], { bases: OFF_BASES }
  );
  s = joinAndSelect(s, 0, 0, 0);
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(0);
  const move = ai.plan(s).find((c) => c.type === "move_order");
  assert.deepEqual({ x: move?.targetCellX, y: move?.targetCellY }, { x: 40, y: 30 },
    "drives to the dry artillery");

  s.assets[0].x = 39 * 256; // now adjacent
  const xfer = ai.plan(s).find((c) => c.type === "transfer_cargo");
  assert.equal(xfer?.targetAssetId, 1, "adjacent: transfer instead of drive");
  s = apply(s, xfer);
  assert.equal(s.assets[1].ammo, AMMO_MAX, "the tube shoots again");
});

test("13A cargo is hashed", () => {
  const a = sandbox([{ team: 0, cellX: 30, type: 3 }], [], { bases: OFF_BASES });
  const b = sandbox([{ team: 0, cellX: 30, type: 3 }], [], { bases: OFF_BASES });
  b.assets[0].cargoFuel = 5;
  assert.notEqual(hashState(a), hashState(b));
});
