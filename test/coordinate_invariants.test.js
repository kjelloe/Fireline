// test/coordinate_invariants.test.js — CHARACTERIZATION TESTS, written
// deliberately BEFORE moving entities from cell left-edges to cell
// CENTRES (the mirror-equivariance fix).
//
// These assert what must remain true REGARDLESS of the convention. They
// must pass before the change and after it. Anything that pins an exact
// world number belongs in the milestone tests, not here — this file is
// about behaviour, not coordinates.

import { test } from "node:test";
import assert from "node:assert/strict";
import { cellToWorld, worldToCellFloor } from "../shared/fixedmath.js";
import { createInitialState } from "../engine/state.js";
import { apply } from "../engine/reducer.js";
import { hashState } from "../engine/snapshot.js";
import { GameServer } from "../engine/server.js";
import { sandbox, joinSelectMove, joinAndSelect } from "./helpers.js";

const ASSET_IDLE = 0;

test("INV: a cell round-trips through world space", () => {
  for (const c of [0, 1, 7, 63, 64, 100, 127]) {
    assert.equal(worldToCellFloor(cellToWorld(c)), c,
      `cell ${c} must survive the round trip whatever the convention`);
  }
});

test("INV: a cell's world position sits INSIDE that cell, never on a neighbour", () => {
  for (const c of [0, 5, 63, 64, 127]) {
    const w = cellToWorld(c);
    assert.ok(w >= c * 256 && w < (c + 1) * 256,
      `cellToWorld(${c}) = ${w} escaped cell ${c}`);
  }
});

test("INV: a move order lands the unit IN the ordered cell", () => {
  let s = sandbox([{ team: 0, type: 1 /* scout */, cellX: 10, cellY: 10 }]);
  s = joinSelectMove(s, 0, 0, 0, 20, 14);
  for (let i = 0; i < 600 && s.assets[0].state !== ASSET_IDLE; i++) {
    s = apply(s, { type: "advance_tick" });
  }
  const a = s.assets[0];
  assert.equal(worldToCellFloor(a.x), 20, "arrived in the ordered column");
  assert.equal(worldToCellFloor(a.y), 14, "arrived in the ordered row");
});

test("INV: standing on a relay captures it", () => {
  let s = sandbox(
    [{ team: 0, type: 0, cellX: 30, cellY: 30 }],
    [{ cellX: 30, cellY: 30, owner: -1 }]
  );
  s = joinAndSelect(s, 0, 0, 0);
  for (let i = 0; i < 200 && s.sites[0].owner !== 0; i++) {
    s = apply(s, { type: "advance_tick" });
  }
  assert.equal(s.sites[0].owner, 0, "presence on the flag cell captures it");
});

test("INV: firing works at range and is refused beyond it", () => {
  const shoot = (gap) => {
    let s = sandbox([
      { team: 0, type: 0, cellX: 20, cellY: 20, ammo: 20 },
      { team: 1, type: 0, cellX: 20 + gap, cellY: 20, hp: 100 },
    ]);
    s = joinAndSelect(s, 0, 0, 0);
    s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
    return s.events.some((e) => e.type === "fire_resolved" || e.type === "asset_damaged")
      || s.assets[1].hp < 100;
  };
  assert.ok(shoot(2), "an adjacent enemy is shootable");
  assert.ok(!shoot(60), "an enemy across the map is not");
});

test("INV: the war is deterministic and replayable", () => {
  const run = () => {
    const server = new GameServer({ mapSeed: 4242, enableAi: true, aiDifficulty: 1 });
    for (let i = 0; i < 600; i++) server.step();
    return hashState(server.state);
  };
  assert.equal(run(), run(), "same seed, same war");
});

test("INV: both teams' spawns are exact mirrors of each other", () => {
  // This is the property the whole coordinate change exists to protect:
  // whatever the convention, team A's spawn column must reflect onto
  // team B's. Cell-level equality holds under either convention; the
  // WORLD-level reflection is what the left-edge convention breaks.
  const s = createInitialState(2026, "frontier_corridor");
  const W = s.map.width;
  const a = s.assets.filter((x) => x.team === 0);
  const b = s.assets.filter((x) => x.team === 1);
  assert.ok(a.length > 0 && b.length > 0);
  const aCols = new Set(a.map((x) => worldToCellFloor(x.x)));
  const bCols = new Set(b.map((x) => worldToCellFloor(x.x)));
  for (const col of aCols) {
    assert.ok(bCols.has(W - 1 - col),
      `team A column ${col} has no mirrored team B column ${W - 1 - col}`);
  }
});

test("INV: sites and standards sit in mirror-paired cells", () => {
  const s = createInitialState(2026, "frontier_corridor");
  const W = s.map.width;
  const cells = s.sites.map((x) => [x.cellX, x.cellY]);
  for (const [cx, cy] of cells) {
    assert.ok(cells.some(([mx, my]) => mx === W - 1 - cx && my === cy),
      `relay (${cx},${cy}) has no mirror`);
  }
  const [s0, s1] = s.standards;
  assert.equal(s1.homeCellX, W - 1 - s0.homeCellX, "standard homes mirror");
});
