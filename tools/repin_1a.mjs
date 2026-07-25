#!/usr/bin/env node
// tools/repin_1a.mjs — re-pin test/fixtures/1A_reducer.json after a state
// schema change. THE RULE: the 14-step command script and its event payloads
// are the verbatim contract — this tool ABORTS if the reducer's events drift.
// Only hashes are regenerated. Usage:
//   node tools/repin_1a.mjs "<one-line reason for the schema change>"

import { readFileSync, writeFileSync } from "node:fs";
import { apply, createInitialState } from "../engine/reducer.js";
import { hashState } from "../engine/snapshot.js";

const reason = process.argv[2];
if (!reason) {
  console.error("Usage: node tools/repin_1a.mjs \"<reason for schema change>\"");
  process.exit(1);
}

const path = new URL("../test/fixtures/1A_reducer.json", import.meta.url);
const fx = JSON.parse(readFileSync(path));
let s = createInitialState(fx.mapSeed, fx.mapProfile);

fx.fixtureVersion = (fx.fixtureVersion ?? 1) + 1;
const today = new Date().toISOString().slice(0, 10);
fx.note = `fixtureVersion ${fx.fixtureVersion} (${today}): ${reason}; hashes re-pinned, command script and events still verbatim from v1.`;
fx.initialStateHash = hashState(s);

let drift = false;
for (const step of fx.steps) {
  s = apply(s, step.command);
  if (JSON.stringify(s.events) !== JSON.stringify(step.events)) {
    drift = true;
    console.error("EVENT DRIFT after", JSON.stringify(step.command));
    console.error("  got:  ", JSON.stringify(s.events));
    console.error("  want: ", JSON.stringify(step.events));
  }
  step.stateHashAfter = hashState(s);
}
fx.finalStateHash = hashState(s);

if (drift) {
  console.error("\nNOT WRITING — the event contract broke. Fix the reducer, not the fixture.");
  process.exit(1);
}
writeFileSync(path, JSON.stringify(fx, null, 2) + "\n");
console.log(`1A re-pinned as fixtureVersion ${fx.fixtureVersion}. Remember: hashState changes must land in BOTH engine/snapshot.js and test/milestone1a.test.js.`);
