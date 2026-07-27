// test/move_symmetry.test.js — the riverline east-edge root cause
// (2026-07-27): movement used floorDivI32 on SIGNED trig products, so
// westward/northward steps rounded toward -inf and gained up to a unit
// per tick over their mirrors (floor(-9050/256) = -36 vs +9050 -> 35).
// On the bridge-channeled riverline map that compounding edge decided
// wars ~59/41 for the east side and flipped perfectly under world
// reflection. Movement must be EXACTLY mirror-symmetric.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { cellToWorld } from "../shared/fixedmath.js";
import { sandbox, joinAndSelect } from "./helpers.js";

// Drive one PRE-ALIGNED asset toward a target for N ticks; return the
// ground covered. Aligned start isolates stepping from turn transients.
function distanceCovered(heading, targetCellX, targetCellY, ticks = 40) {
  let s = sandbox([{ team: 0, cellX: 32, cellY: 32, heading }]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "move_order", operatorId: 0, targetCellX, targetCellY });
  for (let i = 0; i < ticks; i++) s = apply(s, { type: "advance_tick" });
  const a = s.assets[0];
  return {
    dx: Math.abs(a.x - cellToWorld(32)),
    dy: Math.abs(a.y - cellToWorld(32)),
  };
}

test("cardinal mirror pairs cover identical ground", () => {
  const east = distanceCovered(0, 60, 32);
  const west = distanceCovered(128, 4, 32);
  assert.equal(east.dx, west.dx, `east ${east.dx} vs west ${west.dx}`);
  const south = distanceCovered(64, 32, 60);
  const north = distanceCovered(192, 32, 4);
  assert.equal(south.dy, north.dy, `south ${south.dy} vs north ${north.dy}`);
});

test("diagonal mirror pairs cover identical ground (the floor-div bug)", () => {
  const se = distanceCovered(32, 60, 60);
  const sw = distanceCovered(96, 4, 60);
  const ne = distanceCovered(224, 60, 4);
  const nw = distanceCovered(160, 4, 4);
  for (const [name, d] of [["sw", sw], ["ne", ne], ["nw", nw]]) {
    assert.equal(d.dx, se.dx, `${name}.dx ${d.dx} vs se.dx ${se.dx}`);
    assert.equal(d.dy, se.dy, `${name}.dy ${d.dy} vs se.dy ${se.dy}`);
  }
});
