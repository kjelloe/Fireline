// test/headless/runner.js
// Headless primitive soak and seed-batch reporter.
// Generates pinnable sfc32 vectors and PRNG soak diagnostics.
// Run: node test/headless/runner.js

import { mix32, seedSfc32, sfc32Next } from "../../shared/prng.js";
import { computeFnv1a64, hashToHex64, createByteWriter } from "../../shared/canonical.js";

const SEEDS = [0, 1, 42, 0xDEADBEEF >>> 0, 4294967295];
const STEPS = 8;

console.log("=== Headless Primitive Soak Report ===\n");

for (const seed of SEEDS) {
  const state0 = seedSfc32(seed);
  const outputs = [];
  let s = state0;
  for (let i = 0; i < STEPS; i++) {
    const r = sfc32Next(s);
    outputs.push(r.value);
    s = r.nextState;
  }

  // Hash the output sequence for a compact cross-language anchor
  const w = createByteWriter();
  for (const v of outputs) w.writeU32LE(v);
  const { hashHi, hashLo } = computeFnv1a64(w.toBytes());
  const seqHash = hashToHex64(hashHi, hashLo);

  console.log(`Seed: ${seed}`);
  console.log(`  Initial state: a=${state0.a} b=${state0.b} c=${state0.c} d=${state0.d}`);
  console.log(`  First ${STEPS} outputs: [${outputs.join(", ")}]`);
  console.log(`  Sequence hash (FNV-1a 64): ${seqHash}`);
  console.log();
}

console.log("=== mix32 spot checks ===");
for (const seed of [0, 1, 4294967295]) {
  console.log(`  mix32(${seed}) = ${mix32(seed)}`);
}

console.log("\nPaste the above into test/fixtures/0D_sfc32_vectors.json to pin the contract.");
