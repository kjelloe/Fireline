// test/milestone9d.test.js — Slice 9D: Minimum Playability Guarantee.
// A depleted team's home base slow-manufactures: the oldest eligible wreck
// is rebuilt at its original spawn (spec 01 §9, cadence per ruling Q5).

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, MPG_MIN_OPERABLE, MPG_TICKS } from "../engine/reducer.js";
import { createInitialState, fieldSpawnFor, ASSET_IDLE, ASSET_DISABLED } from "../engine/state.js";
import { hashState } from "../engine/snapshot.js";
import { cellToWorld } from "../shared/fixedmath.js";

function depletedState() {
  // Wreck all 12 team-A reserves (ids 8-19): 4 operable left, below 6.
  const s = createInitialState(42, "frontier_corridor");
  for (const a of s.assets) {
    if (a.team === 0 && a.id >= 8) {
      a.state = ASSET_DISABLED;
      a.hp = 0;
    }
  }
  return s;
}

test("9D a healthy team never manufactures", () => {
  let s = createInitialState(42, "frontier_corridor");
  for (let i = 0; i < 30; i++) s = apply(s, { type: "advance_tick" });
  assert.deepEqual(s.manufacture, [0, 0]);
  assert.equal(s.events.some((e) => e.type === "asset_manufactured"), false);
});

test("9D a depleted team rebuilds its oldest wreck at the original spawn", () => {
  let s = depletedState();
  for (let i = 0; i < MPG_TICKS - 1; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.manufacture[0], MPG_TICKS - 1, "timer counting");
  assert.equal(s.assets[8].state, ASSET_DISABLED, "not yet");

  s = apply(s, { type: "advance_tick" });
  const rebuilt = s.events.find((e) => e.type === "asset_manufactured");
  assert.deepEqual(rebuilt, { type: "asset_manufactured", assetId: 8, team: 0 },
    "lowest wrecked id rebuilds first");
  // Rebuilds spawn base-derived now (mirror-honest — the MIRROR-sweep
  // caveat fix): position comes from the team's ACTUAL base in state.
  const spawn = fieldSpawnFor(8, s.bases);
  assert.equal(s.assets[8].state, ASSET_IDLE);
  assert.equal(s.assets[8].x, cellToWorld(spawn.cellX), "back at the team's base");
  assert.equal(s.assets[8].hp, 60, "half of the carrier's 120 hull");
  assert.equal(s.manufacture[0], 0, "timer reset");
});

test("9D wrecks under tow or in the repair bay are not cannibalized", () => {
  let s = depletedState();
  // Stage the claims OUTSIDE the base (a towed wreck inside the base would
  // legitimately enter the repair bay and stop being a wreck at all).
  s.assets[8].towedBy = 99;                 // rescue claim, tower far away
  s.assets[8].x = cellToWorld(60);
  s.assets[9].recoverTimer = MPG_TICKS + 50; // deep in the repair bay
  for (let i = 0; i < MPG_TICKS; i++) s = apply(s, { type: "advance_tick" });
  const rebuilt = s.events.find((e) => e.type === "asset_manufactured");
  assert.equal(rebuilt.assetId, 10, "skips towed and recovering hulls");
});

test("9D with no eligible hull the timer holds and fires when one appears", () => {
  let s = depletedState();
  for (const a of s.assets) {
    if (a.team === 0 && a.state === ASSET_DISABLED) {
      a.towedBy = 99;            // all claimed by rescues...
      a.x = cellToWorld(60 + a.id); // ...parked outside the repair bay
    }
  }
  for (let i = 0; i < MPG_TICKS + 20; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.events.some((e) => e.type === "asset_manufactured"), false);
  assert.equal(s.manufacture[0], MPG_TICKS, "held at threshold");

  s.assets[11].towedBy = -1; // a hull frees up
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.events.find((e) => e.type === "asset_manufactured")?.assetId, 11);
});

test("9D fieldSpawnFor matches the fielded layout for every asset id", () => {
  const s = createInitialState(42, "frontier_corridor");
  for (const a of s.assets) {
    const spawn = fieldSpawnFor(a.id);
    assert.equal(spawn.team, a.team, `asset ${a.id} team`);
    assert.equal(spawn.type, a.type, `asset ${a.id} type`);
    assert.equal(cellToWorld(spawn.cellX), a.x, `asset ${a.id} x`);
    assert.equal(cellToWorld(spawn.cellY), a.y, `asset ${a.id} y`);
  }
});

test("9D manufacture timers are hashed and deterministic", () => {
  const run = () => {
    let s = depletedState();
    for (let i = 0; i < MPG_TICKS + 10; i++) s = apply(s, { type: "advance_tick" });
    return hashState(s);
  };
  assert.equal(run(), run());

  const a = createInitialState(42, "frontier_corridor");
  const b = createInitialState(42, "frontier_corridor");
  b.manufacture[1] = 3;
  assert.notEqual(hashState(a), hashState(b));
});
