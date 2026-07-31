// test/mirror_laws.test.js — the two engine laws from the residue
// ladder (dev-log 2026-08-01), pinned as unit contracts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleCellX, cellToWorld } from "../shared/fixedmath.js";
import { findCellPath } from "../engine/pathfind.js";
import { createInitialState } from "../engine/state.js";
import { getUnitStats } from "../engine/units.js";

const W = 128;
const mxPoint = (x) => W * 256 - x;

test("boundary-parity law: sampleCellX commutes with the x-mirror everywhere", () => {
  // Sweep every boundary point and a spread of interior points: the
  // sampled cell of the mirrored point must be the mirrored cell.
  for (let x = 256; x < W * 256; x += 256) {
    if (x === W * 128) continue; // the exact centre is its OWN mirror:
    // both worlds see the same point and sample the same cell —
    // consistency, not bias (no cell can be both 63 and 64).
    const c = sampleCellX(x, W);
    const cm = sampleCellX(mxPoint(x), W);
    assert.equal(cm, W - 1 - c, `boundary ${x}: ${c} vs ${cm}`);
  }
  assert.equal(sampleCellX(W * 128, W), sampleCellX(mxPoint(W * 128), W),
    "the centre point is self-consistent across worlds");
  for (let x = 1; x < W * 256; x += 977) { // odd stride: interiors incl. centres
    const c = sampleCellX(x, W);
    const cm = sampleCellX(mxPoint(x), W);
    assert.equal(cm, W - 1 - c, `interior ${x}`);
  }
  // Cell CENTRES sample their own cell (the resting convention holds).
  for (let c = 0; c < W; c += 13) {
    assert.equal(sampleCellX(cellToWorld(c), W), c);
  }
});

test("A* origin-side law: wall-detour paths mirror exactly (the tick-2 pair)", () => {
  // The live pair that caught the residue: base-wall detours from the
  // spawn produce equal-cost mirror-partner paths; the origin-side
  // tie-break must pick mirrored shapes. Sweep several goal rows.
  const s = createInitialState(2026, "frontier_corridor");
  const stats = getUnitStats(0);
  for (const [fx, fy, tx, ty] of [
    [7, 56, 48, 56], [7, 60, 40, 50], [8, 58, 52, 63], [7, 56, 30, 70],
  ]) {
    const p = findCellPath(s.map, fx, fy, tx, ty, stats);
    // Mirror the MAP and the trip; the path must be the cell-mirror.
    const mmap = { width: s.map.width, height: s.map.height, cells: new Uint8Array(s.map.cells) };
    for (let y = 0; y < mmap.height; y++) {
      for (let x = 0; x < W / 2; x++) {
        const a = y * W + x, b = y * W + (W - 1 - x);
        const t = mmap.cells[a]; mmap.cells[a] = mmap.cells[b]; mmap.cells[b] = t;
      }
    }
    const pm = findCellPath(mmap, W - 1 - fx, fy, W - 1 - tx, ty, stats);
    assert.ok(p && pm, `paths exist for ${fx},${fy}->${tx},${ty}`);
    assert.equal(pm.length, p.length, "equal length");
    for (let i = 0; i < p.length; i++) {
      assert.equal(pm[i][0], W - 1 - p[i][0], `leg ${i} x mirrors (${fx},${fy}->${tx},${ty})`);
      assert.equal(pm[i][1], p[i][1], `leg ${i} y equal`);
    }
  }
});
