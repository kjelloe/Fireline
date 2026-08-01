// Regen the 0I terrain parity fixture after an INTENTIONAL generator
// change (prompt 143: mirror-by-construction). Probes re-sampled at the
// same coordinates; hashes/counts re-pinned from the new generator.
import { readFileSync, writeFileSync } from "node:fs";
import { computeFnv1a64, hashToHex64 } from "../shared/canonical.js";
import { generateFrontierCorridor } from "../engine/frontier_corridor.js";

const path = new URL("../test/fixtures/0I_frontier_corridor_128.json", import.meta.url);
const fx = JSON.parse(readFileSync(path));
for (const c of fx.cases) {
  const map = generateFrontierCorridor(c.rootSeed);
  const digest = computeFnv1a64(map.cells);
  c.expectedHashFnv1a64 = hashToHex64(digest.hashHi, digest.hashLo);
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const t of map.cells) counts[t]++;
  c.expectedTerrainCounts = counts;
  for (const probe of c.probes) {
    probe.expectedTerrain = map.cells[probe.y * 128 + probe.x];
  }
}
fx.fixtureVersion = 6;
fx.provenance = "prompt-143: mirror-BY-CONSTRUCTION (west-half noise reflected east, budgets 550/55) — the directional-residue root fix; re-pinned from the new generator";
writeFileSync(path, JSON.stringify(fx, null, 1) + "\n");
console.log("0I re-pinned v6");
