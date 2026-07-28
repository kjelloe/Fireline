// test/bridge_demolition.test.js — 13E wired end to end on riverline:
// artillery drops a span, the crossing becomes water, the Skimmer still
// gets across, and EITHER team's truck can rebuild it (prompt-70).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../engine/state.js";
import { apply } from "../engine/reducer.js";
import { hashState } from "../engine/snapshot.js";
import { BRIDGE_HP_MAX, bridgeCells } from "../engine/bridges.js";
import { joinAndSelect } from "./helpers.js";

const T_ROAD = 1, T_WATER = 6;
const UNIT_ARTILLERY = 2, UNIT_TRUCK = 3, UNIT_SKIMMER = 8;
const CENTRAL = 1; // the main road crossing
const at = (s, x, y) => s.map.cells[y * s.map.width + x];

// Put a crewed asset of `type` at a cell, fully supplied, and hand its
// operator the seat. Riverline bases are far from the bridges, so the
// tests place assets directly.
function stage(type, cellX, cellY, team = 0, operatorId = 0) {
  let s = createInitialState(2026, "riverline");
  // Whole-map bases so supply never confounds the subject under test.
  s.bases = [
    { team: 0, x: 0, y: 0, width: s.map.width, height: s.map.height },
    { team: 1, x: 0, y: 0, width: s.map.width, height: s.map.height },
  ];
  const a = s.assets[0];
  a.type = type;
  a.team = team;
  a.x = cellX * 256;
  a.y = cellY * 256;
  a.ammo = 20;
  a.fuel = 4000;
  a.materiel = 1;
  a.reloadTimer = 0;
  s.operators[operatorId].team = team;
  s = joinAndSelect(s, operatorId, team, 0);
  return s;
}

test("13E riverline starts with three intact bridges; frontier has none", () => {
  const r = createInitialState(2026, "riverline");
  assert.equal(r.bridges.length, 3);
  assert.ok(r.bridges.every((b) => b.hp === BRIDGE_HP_MAX));
  assert.deepEqual(createInitialState(2026, "frontier_corridor").bridges, []);
  assert.deepEqual(createInitialState(2026, "sawtooth").bridges, []);
});

test("13E only artillery can drop a bridge", () => {
  let s = stage(0 /* tank */, 58, 63);
  s = apply(s, { type: "fire_order", operatorId: 0, targetBridgeId: CENTRAL });
  assert.ok(s.events.some((e) => e.type === "rejected" && e.reason === "cannot breach bridges"),
    JSON.stringify(s.events));
  assert.equal(s.bridges[CENTRAL].hp, BRIDGE_HP_MAX, "the span is untouched");
});

test("13E artillery shells a span, drops it, and the crossing becomes WATER", () => {
  let s = stage(UNIT_ARTILLERY, 58, 63);
  assert.equal(at(s, 63, 63), T_ROAD, "the crossing starts as road");

  let shells = 0;
  for (let i = 0; i < 60 && s.bridges[CENTRAL].hp > 0; i++) {
    s = apply(s, { type: "fire_order", operatorId: 0, targetBridgeId: CENTRAL });
    if (s.events.some((e) => e.type === "bridge_shelled")) shells += 1;
    s.assets[0].reloadTimer = 0; // fast-forward the gun, not the rules
    s.assets[0].ammo = 20;
  }
  assert.ok(shells >= 2, `took more than one shell to drop (${shells})`);
  assert.equal(s.bridges[CENTRAL].hp, 0);
  assert.ok(s.events.some((e) => e.type === "bridge_breached" && e.bridgeId === CENTRAL));

  for (const [x, y] of bridgeCells("riverline", CENTRAL)) {
    assert.equal(at(s, x, y), T_WATER, `breached cell (${x},${y}) should be water`);
  }
  assert.equal(at(s, 63, 21), T_ROAD, "the northern bridge is untouched");

  // Shelling it again is refused, not silently repeated.
  s = apply(s, { type: "fire_order", operatorId: 0, targetBridgeId: CENTRAL });
  assert.ok(s.events.some((e) => e.type === "rejected" && e.reason === "bridge already down"));
});

test("13E a breached span still carries the Skimmer, but mires a tank", () => {
  // Drop the central bridge, then drive each chassis onto it.
  const breach = (type, team) => {
    let s = stage(type, 63, 60, team);
    s.bridges[CENTRAL].hp = 0;
    for (const [x, y] of bridgeCells("riverline", CENTRAL)) {
      s.map.cells[y * s.map.width + x] = T_WATER;
    }
    s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 63, targetCellY: 66 });
    const startY = s.assets[0].y;
    for (let i = 0; i < 120; i++) s = apply(s, { type: "advance_tick" });
    return { moved: s.assets[0].y - startY, arrived: s.assets[0].state === 0 /* IDLE */ };
  };
  const skimmer = breach(UNIT_SKIMMER, 1); // the Outlier unique
  const tank = breach(0, 0);
  // The claim is not "the Skimmer is faster" but "the Skimmer gets
  // across while the tank is still wallowing" — measuring raw distance
  // understates it, because the Skimmer ARRIVES and stops.
  assert.ok(skimmer.arrived, "the Skimmer should complete the crossing");
  assert.ok(!tank.arrived, "the tank should still be fording");
  assert.ok(tank.moved > 0, "water is misery, not a wall — the tank does inch across");
  assert.ok(skimmer.moved > tank.moved,
    `Skimmer ${skimmer.moved} vs tank ${tank.moved}`);
});

test("13E EITHER team's truck rebuilds a dropped span (prompt-70)", () => {
  for (const team of [0, 1]) {
    let s = stage(UNIT_TRUCK, 59, 63, team);
    s.bridges[CENTRAL].hp = 0;
    for (const [x, y] of bridgeCells("riverline", CENTRAL)) {
      s.map.cells[y * s.map.width + x] = T_WATER;
    }
    s.assets[0].materiel = 1;
    let repaired = false;
    for (let i = 0; i < 40 && !repaired; i++) {
      s = apply(s, { type: "advance_tick" });
      repaired = s.events.some((e) => e.type === "bridge_repaired" && e.bridgeId === CENTRAL);
    }
    assert.ok(repaired, `team ${team} should be able to rebuild the span`);
    assert.equal(s.bridges[CENTRAL].hp, BRIDGE_HP_MAX);
    assert.equal(at(s, 63, 63), T_ROAD, "the road is back");
    assert.equal(s.assets[0].materiel, 0, "the repair consumed the load");
  }
});

test("13E bridge hp is hashed, and the whole cycle stays deterministic", () => {
  const a = createInitialState(2026, "riverline");
  const b = createInitialState(2026, "riverline");
  assert.equal(hashState(a), hashState(b));
  b.bridges[CENTRAL].hp = 0;
  assert.notEqual(hashState(a), hashState(b), "a dropped bridge must change the hash");

  // Same commands from the same seed produce the same war, terrain and all.
  const run = () => {
    let s = stage(UNIT_ARTILLERY, 58, 63);
    for (let i = 0; i < 40; i++) {
      s = apply(s, { type: "fire_order", operatorId: 0, targetBridgeId: CENTRAL });
      s = apply(s, { type: "advance_tick" });
    }
    return s;
  };
  const one = run();
  const two = run();
  assert.equal(hashState(one), hashState(two));
  assert.deepEqual(Array.from(one.map.cells), Array.from(two.map.cells),
    "terrain mutation is reproducible, not incidental");
});
