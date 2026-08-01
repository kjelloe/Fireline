// test/map_symmetry.test.js — the invariant that was ALWAYS claimed and
// never cell-tested (prompt 143, the residue hunt's root): every profile's
// TERRAIN is an exact mirror about x' = W-1-x, for every seed. Layout
// tests pinned relays/spawns/patrols; frontier's noise violated the cell
// level for ~1,600 pairs per seed and fed every frontier-clustered
// directional signature.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAP_PROFILES } from "../engine/state.js";

test("every profile's terrain mirrors exactly, cell for cell", () => {
  for (const [name, gen] of Object.entries(MAP_PROFILES)) {
    for (const seed of [1, 777, 2026, 31337, 9001]) {
      const map = gen(seed);
      const W = map.width;
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < W / 2; x++) {
          assert.equal(map.cells[y * W + x], map.cells[y * W + (W - 1 - x)],
            `${name} seed ${seed}: cell (${x},${y}) != mirror (${W - 1 - x},${y})`);
        }
      }
    }
  }
});
