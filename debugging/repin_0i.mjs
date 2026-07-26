// Re-pin the 0I frontier map fixture after a deliberate terrain change
// (11N woodland paths). Probes are re-evaluated against the new
// generator; any probe whose terrain changed is updated in place.
import { readFileSync, writeFileSync } from "node:fs";
import { generateFrontierCorridor, FRONTIER_CORRIDOR } from "../engine/frontier_corridor.js";
import { computeFnv1a64, hashToHex64 } from "../shared/canonical.js";

const path = "test/fixtures/0I_frontier_corridor_128.json";
const fx = JSON.parse(readFileSync(path));
const idx = (x, y) => y * FRONTIER_CORRIDOR.width + x;

for (const c of fx.cases) {
  const map = generateFrontierCorridor(c.rootSeed);
  const digest = computeFnv1a64(map.cells);
  c.expectedHashFnv1a64 = hashToHex64(digest.hashHi, digest.hashLo);
  const counts = new Array(6).fill(0);
  for (const cell of map.cells) counts[cell] += 1;
  c.expectedTerrainCounts = counts;
  for (const probe of c.probes) {
    probe.expectedTerrain = map.cells[idx(probe.x, probe.y)];
  }
}
fx.terrainIds["5"] = "path";
fx.fixtureVersion = (fx.fixtureVersion ?? 1) + 1;
fx.provenance = "11N: mirrored woodland paths added (rows 40/41/86/87, x 24..103); terrain id 5";
writeFileSync(path, JSON.stringify(fx, null, 1) + "\n");
console.log("0I re-pinned, version", fx.fixtureVersion);
