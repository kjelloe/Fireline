// test/stations.test.js — crew stations prototype (prompt 100): the
// carrier's MG ring and the scout's AT launcher. Board mirrors
// select_asset (garage-style); the station fires its own weapon on its
// own clock; crews bail out like drivers; the AT rack rearms at base.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, RECOG_KILL, DEED_KILL } from "../engine/reducer.js";
import { getUnitStats, UNIT_CARRIER, UNIT_SCOUT } from "../engine/units.js";
import { OP_DOWN, ASSET_DISABLED } from "../engine/state.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const OFF_BASES = [
  { team: 0, x: 0, y: 0, width: 4, height: 4 },
  { team: 1, x: 60, y: 60, width: 4, height: 4 },
];

function crewedCarrierScene() {
  // Driver (op 0) in the carrier; op 1 joins seatless; an enemy nearby.
  let s = sandbox([
    { team: 0, type: 4, cellX: 20, cellY: 20 },
    { team: 1, type: 1, cellX: 22, cellY: 20, hp: 8 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "join_operator", operatorId: 1, team: 0 });
  return s;
}

test("stations: board is garage-style, one body one post, no double manning", () => {
  let s = crewedCarrierScene();
  s = apply(s, { type: "board_station", operatorId: 1, assetId: 0 });
  assert.equal(s.assets[0].stationOp, 1, "op 1 mans the MG");
  assert.ok(s.events.some((e) => e.type === "station_boarded" && e.kind === "mg"));

  const second = apply(apply(s, { type: "join_operator", operatorId: 2, team: 0 }),
    { type: "board_station", operatorId: 2, assetId: 0 });
  assert.equal(second.events.at(-1).reason, "station taken");

  // The DRIVER cannot man the ring while driving.
  const driver = apply(s, { type: "board_station", operatorId: 0, assetId: 0 });
  assert.equal(driver.events.at(-1).reason, "leave your asset first");

  // Taking a driving seat releases the station.
  s.assets.push(s.assets[0]); // placeholder guard: never used
  s.assets.pop();
  let swap = sandbox([
    { team: 0, type: 4, cellX: 20, cellY: 20 },
    { team: 0, type: 0, cellX: 24, cellY: 20 },
  ]);
  swap = apply(swap, { type: "join_operator", operatorId: 1, team: 0 });
  swap = apply(swap, { type: "board_station", operatorId: 1, assetId: 0 });
  swap = apply(swap, { type: "select_asset", operatorId: 1, assetId: 1, confirm: true });
  assert.equal(swap.assets[0].stationOp, -1, "driving auto-releases the station");
  assert.equal(swap.assets[1].operatorId, 1);
});

test("stations: the MG fires off the hull's ammo, suppresses, and kills pay the trigger seat", () => {
  let s = crewedCarrierScene();
  s = apply(s, { type: "board_station", operatorId: 1, assetId: 0 });
  const ammoBefore = s.assets[0].ammo;
  s = apply(s, { type: "station_fire", operatorId: 1, targetAssetId: 1 });
  const shot = s.events.find((e) => e.type === "fire_resolved" && e.station === 1);
  assert.ok(shot, "the ring spoke");
  assert.equal(s.assets[0].ammo, ammoBefore - 1, "hull pool pays for MG fire");
  assert.equal(s.assets[0].stationReload, getUnitStats(UNIT_CARRIER).station.reloadTicks);
  // 8 hp - 4 damage = 4: suppressed, alive. Second shot after reload kills.
  assert.equal(s.assets[1].hp, 4);
  assert.ok(s.assets[1].suppressedTimer > 0, "MG suppresses");
  const again = apply(s, { type: "station_fire", operatorId: 1, targetAssetId: 1 });
  assert.equal(again.events.at(-1).reason, "reloading", "its own clock");
  for (let i = 0; i < getUnitStats(UNIT_CARRIER).station.reloadTicks; i++) {
    s = apply(s, { type: "advance_tick" });
  }
  s = apply(s, { type: "station_fire", operatorId: 1, targetAssetId: 1 });
  assert.equal(s.assets[1].state, ASSET_DISABLED, "second burst kills");
  assert.equal(s.operators[1].score, RECOG_KILL, "the trigger seat gets the kill");
  assert.equal(s.operators[1].deeds[DEED_KILL], 1);
});

test("stations: the AT launcher runs on its own four missiles and rearms at base", () => {
  const rack = getUnitStats(UNIT_SCOUT).station;
  assert.equal(rack.kind, "at");
  let s = sandbox([
    { team: 0, type: 1, cellX: 2, cellY: 2 },          // scout parked at base
    { team: 1, type: 0, cellX: 6, cellY: 2, hp: 200 },
  ], [], { bases: [
    { team: 0, x: 0, y: 0, width: 4, height: 4 },
    { team: 1, x: 60, y: 60, width: 4, height: 4 },
  ] });
  s.assets[0].stationAmmo = 1; // one missile left
  s = apply(s, { type: "join_operator", operatorId: 1, team: 0 });
  s = apply(s, { type: "board_station", operatorId: 1, assetId: 0 });
  const ammoBefore = s.assets[0].ammo;
  s = apply(s, { type: "station_fire", operatorId: 1, targetAssetId: 1 });
  assert.equal(s.assets[1].hp, 200 - rack.damage, "TOW punch");
  assert.equal(s.assets[0].stationAmmo, 0, "missile spent");
  assert.equal(s.assets[0].ammo, ammoBefore, "hull pool untouched — its own rack");
  const dry = apply(s, { type: "station_fire", operatorId: 1, targetAssetId: 1 });
  assert.ok(["reloading", "out of ammo"].includes(dry.events.at(-1).reason));
  // Idle at base: the rack rearms with everything else.
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].stationAmmo, rack.shots, "rearmed at home");
});

test("stations: the crew bails out with the hull, like a driver", () => {
  let s = crewedCarrierScene();
  s = apply(s, { type: "board_station", operatorId: 1, assetId: 0 });
  s.assets[0].hp = 0;
  s.assets[0].state = 0;
  // Kill the carrier via a mine-free direct path: enemy scout shoots it.
  let e = sandbox([
    { team: 0, type: 4, cellX: 20, cellY: 20, hp: 5, stationOp: 1 },
    { team: 1, type: 1, cellX: 22, cellY: 20 },
  ]);
  e = apply(e, { type: "join_operator", operatorId: 1, team: 0 });
  e = joinAndSelect(e, 16, 1, 1);
  e = apply(e, { type: "fire_order", operatorId: 16, targetAssetId: 0 });
  assert.equal(e.assets[0].state, ASSET_DISABLED);
  assert.equal(e.assets[0].stationOp, -1, "the seat is empty");
  assert.equal(e.operators[1].state, OP_DOWN, "the gunner is on foot");
  assert.ok(e.downed.some((d) => d.operatorId === 1), "with a body on the ground");
});
