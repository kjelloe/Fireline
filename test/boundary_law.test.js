// test/boundary_law.test.js — enforcement for specs/08 §7: no NEW
// x-position DECISION may floor through worldToCellFloor. The 75-site
// sweep (dev-log 2026-08-01) is protected by source lint: any engine
// file that samples a continuous .x with plain floor fails here.
// y-floors are exempt (the mirror is x-only); cell-latticed values
// (targetX after snap) are the reviewed exceptions listed below.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FILES = [
  "engine/reducer.js", "engine/ai_regency.js", "engine/sites.js",
  "engine/downed.js", "engine/recovery.js", "engine/supply.js",
  "engine/los.js", "engine/mines.js", "engine/standards.js",
  "engine/pathfind.js", "engine/route_graph.js", "engine/bridges.js",
];

// Reviewed exceptions: pure y-uses share lines with nothing, and
// lattice-snapped x-values (targetX is always cellToWorld-snapped)
// are safe under plain floor. Add a line here ONLY with a review.
const ALLOWED = [
  /worldToCellFloor\([^)]*\.y\)/,
  /worldToCellFloor\([^)]*[yY]\)/,
  /worldToCellFloor\(\s*(asset|a|e|d|down|body|scout|truck|carrier|other|w|cv|c)\.targetX/,
  /worldToCellFloor\(down\.targetX\)/,
  /import/,
];

test("specs/08 §7 enforcement: no plain x-floor at decision sites", () => {
  // PER-CALL granularity (the POWS-root lesson, prompt 161): the old
  // line-level allowlist let an x-floor SHARE A LINE with a y-floor
  // and slip through — reducer's A* start cell hid that way for two
  // days and cost POWS=2 twenty fairness points.
  const offenders = [];
  const CALL = /worldToCellFloor\(\s*([^)]*)\)/g;
  for (const f of FILES) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    src.split("\n").forEach((line, i) => {
      if (!line.includes("worldToCellFloor(")) return;
      if (/import/.test(line)) return;
      for (const m of line.matchAll(CALL)) {
        const arg = m[1];
        if (/\.y\b|[yY]$|[yY]\s*$/.test(arg.trim())) continue; // y-uses are lawful
        if (/targetX/.test(arg)) continue; // lattice-snapped by construction
        offenders.push(`${f}:${i + 1}: worldToCellFloor(${arg.trim()})`);
      }
    });
  }
  assert.deepEqual(offenders, [],
    "x-position decisions must use sampleCellX (specs/08 §7)");
});
