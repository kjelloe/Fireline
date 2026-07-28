// test/bridges.test.js — 13E groundwork: the pure bridge module.
// Wiring (state field, siege, repair, repin) lands next; this pins the
// geometry and the terrain mutation first, because everything else
// depends on them being mirror-honest.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRIDGE_HP_MAX, bridgeSpans, createBridges, bridgeIntact, bridgeCells,
  bridgeAtCell, adjacentToBridge, applyBridgeTerrain, breachedHazards,
} from "../engine/bridges.js";
import { generateRiverline } from "../engine/riverline.js";

const T_ROAD = 1, T_WATER = 6;

test("13E riverline has three bridges; other profiles have none", () => {
  assert.equal(bridgeSpans("riverline").length, 3);
  assert.equal(createBridges("riverline").length, 3);
  for (const p of ["frontier_corridor", "blackwood", "sawtooth", "nonesuch"]) {
    assert.deepEqual(createBridges(p), [], `${p} must be inert`);
  }
  assert.ok(createBridges("riverline").every((b) => b.hp === BRIDGE_HP_MAX && bridgeIntact(b)));
});

test("13E the spans are mirror-symmetric in x (specs/08: assert, never assume)", () => {
  for (const span of bridgeSpans("riverline")) {
    const [x0, x1] = span.cols;
    assert.equal(x0, 127 - x1, `span ${x0}..${x1} is not mirror-closed`);
  }
});

test("13E spans match where the generator actually put road over water", () => {
  // The geometry is hand-derived from the map constants, so it can drift
  // from the generator. Pin them together: every bridge cell IS road in
  // a fresh map, and the river between bridges is water.
  const m = generateRiverline(2026);
  const at = (x, y) => m.cells[y * m.width + x];
  for (let id = 0; id < 3; id++) {
    for (const [x, y] of bridgeCells("riverline", id)) {
      assert.equal(at(x, y), T_ROAD, `bridge ${id} cell (${x},${y}) is not road`);
    }
  }
  assert.equal(at(63, 40), T_WATER, "river between bridges stays water");
});

test("13E cell lookup and repair reach", () => {
  assert.equal(bridgeAtCell("riverline", 63, 63), 1, "the central road crossing");
  assert.equal(bridgeAtCell("riverline", 63, 21), 0);
  assert.equal(bridgeAtCell("riverline", 63, 105), 2);
  assert.equal(bridgeAtCell("riverline", 63, 40), -1, "open water is not a bridge");
  assert.equal(bridgeAtCell("riverline", 10, 63), -1, "the road inland is not a bridge");
  // A truck beside the span can work on it; one a cell further cannot.
  assert.ok(adjacentToBridge("riverline", 1, 59, 63), "alongside the west edge");
  assert.ok(adjacentToBridge("riverline", 1, 63, 66), "alongside the south edge");
  assert.ok(!adjacentToBridge("riverline", 1, 57, 63), "two cells away is out of reach");
});

test("13E breaching turns the span to WATER and repair puts the road back", () => {
  const m = generateRiverline(2026);
  const at = (x, y) => m.cells[y * m.width + x];
  applyBridgeTerrain(m, "riverline", 1, false);
  for (const [x, y] of bridgeCells("riverline", 1)) {
    assert.equal(at(x, y), T_WATER, `breached cell (${x},${y}) should be water`);
  }
  assert.equal(at(63, 21), T_ROAD, "the other bridges are untouched");
  applyBridgeTerrain(m, "riverline", 1, true);
  for (const [x, y] of bridgeCells("riverline", 1)) {
    assert.equal(at(x, y), T_ROAD, `repaired cell (${x},${y}) should be road again`);
  }
  // Byte-identical to a fresh map: breach+repair is a true round trip.
  assert.deepEqual(Array.from(m.cells), Array.from(generateRiverline(2026).cells));
});

test("13E breached spans become route-graph hazards (13D reuse), intact ones do not", () => {
  const state = {
    mapProfile: "riverline",
    bridges: [{ id: 0, hp: BRIDGE_HP_MAX }, { id: 1, hp: 0 }, { id: 2, hp: BRIDGE_HP_MAX }],
  };
  const hazards = breachedHazards(state);
  assert.ok(hazards.length > 0, "the breached span reports hazards");
  for (const [, y] of hazards) {
    assert.ok(y >= 62 && y <= 65, `hazard row ${y} should be the breached span's`);
  }
  // Floor+ceil midpoint PAIR — the 13D lesson: a single >>1 midpoint is
  // off-by-one under the mirror.
  const xs = hazards.map(([x]) => x);
  assert.deepEqual(xs, [63, 64], "midpoints sample both sides of the axis");
  assert.deepEqual(breachedHazards({ ...state, bridges: [{ id: 1, hp: 5 }] }), [],
    "a damaged-but-standing bridge is not a hazard");
});
