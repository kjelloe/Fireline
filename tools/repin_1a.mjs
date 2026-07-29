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
fx.initialStateHash = hashState(s);

// A COORDINATE-CONVENTION change (2026-07-30: entities moved from cell
// left edges to cell centres) re-encodes every world coordinate in every
// event without changing what any event MEANS. That is the one drift
// class worth allowing — but only when it can be PROVEN to be exactly
// that, so the guard keeps its teeth. `--shift-coords=<n>` accepts drift
// where every difference is that exact delta on a coordinate field and
// nothing else has moved. Anything unexplained still aborts.
const shiftArg = process.argv.find((a) => a.startsWith("--shift-coords="));
const SHIFT = shiftArg ? Number(shiftArg.split("=")[1]) : 0;
const COORD_FIELD = /^(x|y|targetX|targetY|homeX|homeY)$/;

// Is `got` exactly `want` with SHIFT added to every coordinate field?
function isPureCoordinateShift(got, want) {
  if (!SHIFT) return false;
  if (got.length !== want.length) return false;
  for (let i = 0; i < got.length; i++) {
    const g = got[i];
    const w = want[i];
    const keys = new Set([...Object.keys(g), ...Object.keys(w)]);
    for (const k of keys) {
      if (COORD_FIELD.test(k)) {
        if (g[k] !== w[k] + SHIFT) return false;
      } else if (JSON.stringify(g[k]) !== JSON.stringify(w[k])) {
        return false;
      }
    }
  }
  return true;
}

let drift = false;
let shifted = 0;
for (const step of fx.steps) {
  s = apply(s, step.command);
  if (JSON.stringify(s.events) !== JSON.stringify(step.events)) {
    if (isPureCoordinateShift(s.events, step.events)) {
      // Provably the convention and nothing else: adopt the new encoding.
      step.events = JSON.parse(JSON.stringify(s.events));
      shifted += 1;
    } else {
      drift = true;
      console.error("EVENT DRIFT after", JSON.stringify(step.command));
      console.error("  got:  ", JSON.stringify(s.events));
      console.error("  want: ", JSON.stringify(step.events));
    }
  }
  step.stateHashAfter = hashState(s);
}
if (shifted) {
  console.log(`accepted ${shifted} event(s) as a pure +${SHIFT} coordinate shift (nothing else changed).`);
}
fx.note = `fixtureVersion ${fx.fixtureVersion} (${today}): ${reason}; hashes re-pinned, command script verbatim from v1` +
  (shifted ? `, event coordinates shifted +${SHIFT} (convention change, semantics unchanged).` : ", events still verbatim from v1.");
fx.finalStateHash = hashState(s);

if (drift) {
  console.error("\nNOT WRITING — the event contract broke. Fix the reducer, not the fixture.");
  process.exit(1);
}
writeFileSync(path, JSON.stringify(fx, null, 2) + "\n");
console.log(`1A re-pinned as fixtureVersion ${fx.fixtureVersion}. Remember: hashState changes must land in BOTH engine/snapshot.js and test/milestone1a.test.js.`);
