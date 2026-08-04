// test/build_ghost.test.js — W4-4 (prompt 174): the placement ghost must
// agree with the SERVER, always. The ghost calls the engine's own
// predicates through a view-shaped state, so this suite's real job is to
// prove that the view genuinely carries every input those predicates
// read — if a future ruling adds a placement rule that keys on something
// the client cannot see, THIS test is where it surfaces.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { buildRejection } from "../engine/sandbags.js";
import { getUnitStats } from "../engine/units.js";
import { buildView } from "../engine/view.js";
import { placementVerdict, ghostColor, GHOST_OK, GHOST_BAD } from "../client/js/build_model.js";
import { sandbox, joinAndSelect } from "./helpers.js";
import { T_ROAD, T_OPEN } from "../engine/mapgen.js";

// A truck (type 3: canClearMines) on open ground, plus a road column so
// the two-lane law is exercisable.
function buildState() {
  const size = 64;
  const cells = new Uint8Array(size * size).fill(T_OPEN);
  for (let y = 0; y < size; y++) cells[y * size + 30] = T_ROAD; // one road column
  let s = sandbox(
    [{ team: 0, type: 3, cellX: 20, cellY: 20 }],
    [{ cellX: 50, cellY: 50, owner: 0 }],
    {
      map: { width: size, height: size, cells, seed: 1 },
      bases: [
        { team: 0, x: 0, y: 0, width: 4, height: 8 },
        { team: 1, x: 60, y: 0, width: 4, height: 8 },
      ],
    }
  );
  s = joinAndSelect(s, 0, 0, 0);
  return s;
}

const clientSide = (s) => ({ view: buildView(s, 0), map: s.map });

test("W4-4: the ghost agrees with the engine on EVERY cell it can reach", () => {
  const s = buildState();
  const { view, map } = clientSide(s);
  const truck = s.assets[0];
  const stats = getUnitStats(truck.type);
  let checked = 0;
  let refusals = 0;
  // Sweep a window that spans open ground, the road column, the base
  // zone, and the relay site — i.e. several distinct rejection reasons.
  for (let cx = 0; cx < 56; cx += 3) {
    for (let cy = 0; cy < 56; cy += 3) {
      const truth = buildRejection(s, truck, stats, cx, cy);
      const ghost = placementVerdict(view, map, view.friendlyAssets[0], "sandbag", cx, cy);
      assert.equal(ghost.ok, truth === null,
        `verdict differs at (${cx},${cy}): engine ${truth}, ghost ${ghost.reason}`);
      assert.equal(ghost.reason, truth, `reason differs at (${cx},${cy})`);
      checked++;
      if (truth !== null) refusals++;
    }
  }
  assert.ok(checked > 300, `swept a real window (${checked} cells)`);
  assert.ok(refusals > 0, "and the window contained genuine refusals");
});

test("W4-4: the ghost reproduces the INVISIBLE two-lane road law", () => {
  // The law nobody can see from the cockpit: a road build must leave
  // >= 2 open road cells in its column cross-section. Fill the column
  // down to two lanes and watch the ghost flip.
  let s = buildState();
  const size = s.map.width;
  // A one-cell-wide road column of height 4 (rows 10..13) in column 40.
  const cells = new Uint8Array(s.map.cells);
  for (let y = 0; y < size; y++) cells[y * size + 30] = T_OPEN; // clear the long road
  for (let y = 10; y <= 13; y++) cells[y * size + 40] = T_ROAD;
  s = { ...s, map: { ...s.map, cells } };
  s.sandbags = [
    { id: 0, team: 0, cellX: 40, cellY: 10, hp: 40 },
    { id: 1, team: 0, cellX: 40, cellY: 11, hp: 40 },
  ];
  const { view, map } = clientSide(s);
  const me = view.friendlyAssets[0];
  // Rows 12 and 13 are the last two open lanes: building either leaves
  // one, so the law refuses BOTH — and the ghost must say so.
  for (const cy of [12, 13]) {
    const v = placementVerdict(view, map, me, "sandbag", 40, cy);
    assert.equal(v.ok, false, `row ${cy} refused`);
    assert.equal(v.reason, "the road must keep two lanes");
    assert.equal(ghostColor(v), GHOST_BAD);
  }
  // Open ground beside the road is still fine.
  const beside = placementVerdict(view, map, me, "sandbag", 41, 12);
  assert.equal(beside.ok, true, "the verge is buildable");
  assert.equal(ghostColor(beside), GHOST_OK);
});

test("W4-4: mines get the same treatment (bases and sites refuse)", () => {
  const s = buildState();
  s.assets[0].type = 0; // tank: canMine
  s.assets[0].minesLeft = 2;
  const { view, map } = clientSide(s);
  const me = view.friendlyAssets[0];
  assert.equal(placementVerdict(view, map, me, "mine", 20, 20).ok, true, "open ground mines");
  assert.equal(placementVerdict(view, map, me, "mine", 1, 1).reason, "cannot mine a base zone");
  assert.equal(placementVerdict(view, map, me, "mine", 50, 50).reason, "cannot mine a site");
});

test("W4-4: after a real build the ghost refuses the same cell", () => {
  // End-to-end: the ghost's answer tracks live state, not a snapshot.
  let s = buildState();
  const before = clientSide(s);
  assert.equal(
    placementVerdict(before.view, before.map, before.view.friendlyAssets[0], "sandbag", 21, 20).ok,
    true, "buildable before"
  );
  s = apply(s, { type: "build_sandbag", operatorId: 0, targetCellX: 21, targetCellY: 20 });
  for (let i = 0; i < 60; i++) s = apply(s, { type: "advance_tick" });
  const after = clientSide(s);
  const v = placementVerdict(after.view, after.map, after.view.friendlyAssets[0], "sandbag", 21, 20);
  assert.equal(v.ok, false, "refused once the bags are there");
  // The bag MUTATED the terrain to T_BLOCKING (the bridges precedent), and
  // the buildable-ground check runs before the occupancy check — so this
  // is the reason the server gives, and the ghost must give the same one.
  assert.equal(v.reason, "cannot build on this ground");
  assert.equal(
    v.reason,
    buildRejection(s, s.assets[0], getUnitStats(s.assets[0].type), 21, 20),
    "ghost and engine still agree after a terrain mutation"
  );
});
