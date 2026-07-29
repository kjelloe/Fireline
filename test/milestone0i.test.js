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
    // Item 38: base PERIMETERS are walls-with-gates (0/1/4 legal there);
    // interiors and the objective stay strictly operational ground.
    for (const zone of [FRONTIER_CORRIDOR.teamABase, FRONTIER_CORRIDOR.teamBBase, FRONTIER_CORRIDOR.objective]) {
      for (let y=zone.y; y<zone.y+zone.height; y++) for (let x=zone.x; x<zone.x+zone.width; x++) {
        const onPerimeter = zone !== FRONTIER_CORRIDOR.objective &&
          (x === zone.x || x === zone.x + zone.width - 1 || y === zone.y || y === zone.y + zone.height - 1);
        const t = map.cells[idx(x,y)];
        assert.ok(t === 0 || t === 1 || (onPerimeter && t === 4), `seed ${seed} operational zone ${x},${y}`);
      }
    }
    // And each base wall must have real gates: front + both sides open.
    for (const [base, frontX] of [[FRONTIER_CORRIDOR.teamABase, 23], [FRONTIER_CORRIDOR.teamBBase, 104]]) {
      const gy = base.y + ((base.height - 4) >> 1);
      for (let y = gy; y < gy + 4; y++) assert.notEqual(map.cells[idx(frontX, y)], 4, `seed ${seed} front gate ${frontX},${y}`);
      const gx = base.x + ((base.width - 4) >> 1);
      for (let x = gx; x < gx + 4; x++) {
        assert.notEqual(map.cells[idx(x, base.y)], 4, `seed ${seed} north gate`);
        assert.notEqual(map.cells[idx(x, base.y + base.height - 1)], 4, `seed ${seed} south gate`);
      }
    }
    assert.deepEqual(Array.from(map.cells), Array.from(generateFrontierCorridor(seed).cells), `seed ${seed} repeatability`);
  }
});
