// test/milestone9f.test.js — Slice 9F: authoritative heading + turn rates.
// Integer brads (0-255), per-chassis turn rates, pivot-then-drive, no orbits.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { getUnitStats, UNIT_TANK, UNIT_SCOUT, UNIT_ARTILLERY } from "../engine/units.js";
import { ASSET_MOVING, ASSET_IDLE } from "../engine/state.js";
import { hashState } from "../engine/snapshot.js";
import { sandbox } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

test("9F turn rates are pinned per chassis", () => {
  assert.equal(getUnitStats(UNIT_TANK).turnRate, 8);
  assert.equal(getUnitStats(UNIT_SCOUT).turnRate, 14);
  assert.equal(getUnitStats(UNIT_ARTILLERY).turnRate, 5);
  assert.equal(getUnitStats(3).turnRate, 10);
  assert.equal(getUnitStats(4).turnRate, 6);
});

test("9F aligned straight-line movement is unchanged (historical pins hold)", () => {
  let s = sandbox([
    { team: 0, cellX: 0, state: ASSET_MOVING, targetX: cellToWorld(20), heading: 0 },
  ]);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].x, 32, "east-facing tank drives east at full speed");
  assert.equal(s.assets[0].y, 0);
  assert.equal(s.assets[0].heading, 0);
});

test("9F a 180-degree order means pivoting first, then driving", () => {
  // Tank faces east (0), ordered due west: 128 brads away, turnRate 8.
  // Ticks 1-11 pivot (off-axis > 32 brads); tick 12 reaches 96 brads —
  // exactly 45 degrees off — and starts rolling while still turning.
  let s = sandbox([
    { team: 0, cellX: 40, state: ASSET_MOVING, targetX: cellToWorld(10), heading: 0 },
  ]);
  const x0 = s.assets[0].x;
  for (let i = 0; i < 11; i++) {
    s = apply(s, { type: "advance_tick" });
    assert.equal(s.assets[0].x, x0, `tick ${i + 1}: still pivoting`);
  }
  assert.equal(s.assets[0].heading, 88, "11 ticks x 8 brads");
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].heading, 96, "still turning as it rolls");
  assert.ok(s.assets[0].x < x0, "driving begins at 45 degrees off-axis");
});

test("9F scouts out-turn artillery", () => {
  const pivotTicks = (type) => {
    let s = sandbox([
      { team: 0, cellX: 40, type, state: ASSET_MOVING, targetX: cellToWorld(10), heading: 0 },
    ]);
    let ticks = 0;
    const x0 = s.assets[0].x;
    while (s.assets[0].x === x0 && ticks < 60) {
      s = apply(s, { type: "advance_tick" });
      ticks++;
    }
    return ticks;
  };
  assert.ok(pivotTicks(UNIT_SCOUT) < pivotTicks(UNIT_ARTILLERY),
    "the scout wheels around long before the gun does");
});

test("9F diagonal orders curve to the target and never orbit", () => {
  let s = sandbox([
    { team: 0, cellX: 5, cellY: 5, state: ASSET_MOVING, heading: 0,
      targetX: cellToWorld(15), targetY: cellToWorld(12) },
  ]);
  let ticks = 0;
  while (s.assets[0].state === ASSET_MOVING && ticks < 400) {
    s = apply(s, { type: "advance_tick" });
    ticks++;
  }
  assert.equal(s.assets[0].state, ASSET_IDLE, "arrived");
  assert.equal(s.assets[0].x, cellToWorld(15), "exactly on target x");
  assert.equal(s.assets[0].y, cellToWorld(12), "exactly on target y");
  assert.ok(ticks < 200, `no orbiting (took ${ticks} ticks)`);
});

test("9F heading is hashed and movement stays deterministic", () => {
  const run = () => {
    let s = sandbox([
      { team: 0, cellX: 5, cellY: 5, state: ASSET_MOVING, heading: 0,
        targetX: cellToWorld(30), targetY: cellToWorld(25) },
      { team: 1, cellX: 50, cellY: 20, state: ASSET_MOVING, heading: 128,
        targetX: cellToWorld(10), targetY: cellToWorld(40) },
    ]);
    for (let i = 0; i < 150; i++) s = apply(s, { type: "advance_tick" });
    return hashState(s);
  };
  assert.equal(run(), run());

  const a = sandbox([{ team: 0, cellX: 0, heading: 0 }]);
  const b = sandbox([{ team: 0, cellX: 0, heading: 64 }]);
  assert.notEqual(hashState(a), hashState(b), "heading participates in the hash");
});
