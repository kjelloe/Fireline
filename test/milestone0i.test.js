// Milestone 0I — frontier_corridor 128x128 parity contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeFnv1a64, hashToHex64 } from "../shared/canonical.js";
import { FRONTIER_CORRIDOR, generateFrontierCorridor, countTerrain } from "../engine/frontier_corridor.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/0I_frontier_corridor_128.json", import.meta.url)));
const idx = (x, y) => y * FRONTIER_CORRIDOR.width + x;

test("0I frontier_corridor 128x128 pinned hashes, counts, and probes", () => {
  for (const c of fx.cases) {
    const map = generateFrontierCorridor(c.rootSeed);
    assert.equal(map.cells.length, 128 * 128, `${c.id} cell count`);
    const digest = computeFnv1a64(map.cells);
    assert.equal(hashToHex64(digest.hashHi, digest.hashLo), c.expectedHashFnv1a64, `${c.id} hash`);
    assert.deepEqual(countTerrain(map.cells), c.expectedTerrainCounts, `${c.id} terrain counts`);
    for (const probe of c.probes) assert.equal(map.cells[idx(probe.x, probe.y)], probe.expectedTerrain, `${c.id} probe ${probe.x},${probe.y}`);
  }
});

test("0I frontier_corridor infrastructure and reproducibility invariants", () => {
  for (const seed of [0, 1, 42, 999, 0xDEADBEEF >>> 0]) {
    const map = generateFrontierCorridor(seed);
    for (const y of FRONTIER_CORRIDOR.roadRows) for (let x = 0; x < 128; x++) assert.equal(map.cells[idx(x,y)], 1, `seed ${seed} road ${x},${y}`);
    for (const zone of [FRONTIER_CORRIDOR.teamABase, FRONTIER_CORRIDOR.teamBBase, FRONTIER_CORRIDOR.objective]) {
      for (let y=zone.y; y<zone.y+zone.height; y++) for (let x=zone.x; x<zone.x+zone.width; x++) {
        assert.ok(map.cells[idx(x,y)] === 0 || map.cells[idx(x,y)] === 1, `seed ${seed} operational zone ${x},${y}`);
      }
    }
    assert.deepEqual(Array.from(map.cells), Array.from(generateFrontierCorridor(seed).cells), `seed ${seed} repeatability`);
  }
});
