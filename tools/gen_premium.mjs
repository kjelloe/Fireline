// tools/gen_premium.mjs — generate the underdog-premium verdict for one
// map from a mirrored battery pair (prompts 58/68: sweep-derived, never
// hand-tuned).
//
//   node tools/gen_premium.mjs reports/sweeps/map_x_uq.csv \
//        reports/sweeps/map_x_uq_mirror.csv <profile>
//
// Convicts ONLY a TEAM-linked lean: the same team ahead in BOTH mirror
// worlds AND the aggregate past PREMIUM_THRESHOLD_PCT. A side-linked
// lean (flips with the mirror) is geometry, not a premium case — the
// disadvantaged SIDE changes every join. Prints the MAP_PREMIUM entry
// to paste into engine/premium.js (the table stays reviewed code, not
// a runtime file read — determinism rule).

import { readFileSync } from "node:fs";
import { PREMIUM_THRESHOLD_PCT } from "../engine/premium.js";

const [normalCsv, mirrorCsv, profile] = process.argv.slice(2);
if (!profile) {
  console.error("usage: gen_premium.mjs <normal.csv> <mirror.csv> <profile>");
  process.exit(2);
}

function winners(path) {
  const rows = readFileSync(path, "utf8").trim().split("\n").slice(1);
  const w = [0, 0];
  for (const r of rows) {
    const win = Number(r.split(",")[4]);
    if (win === 0 || win === 1) w[win] += 1;
  }
  return w;
}

const n = winners(normalCsv);
const m = winners(mirrorCsv);
const aheadNormal = n[0] > n[1] ? 0 : 1;
const aheadMirror = m[0] > m[1] ? 0 : 1;
const aggA = n[0] + m[0];
const aggB = n[1] + m[1];
const aggPctA = (100 * aggA) / (aggA + aggB);
const leadPct = Math.max(aggPctA, 100 - aggPctA);

console.log(`${profile}: normal A ${n[0]}/${n[1]}, mirror A ${m[0]}/${m[1]}, ` +
  `aggregate A ${aggPctA.toFixed(1)}%`);
if (aheadNormal !== aheadMirror) {
  console.log("VERDICT: lean flips with the mirror = side/geometry class — NO premium.");
} else if (leadPct < PREMIUM_THRESHOLD_PCT) {
  console.log(`VERDICT: team-consistent but under ${PREMIUM_THRESHOLD_PCT}% — fair, NO premium.`);
} else {
  const disadvantaged = aggPctA >= PREMIUM_THRESHOLD_PCT ? 1 : 0;
  console.log(`VERDICT: TEAM-linked lean. Paste into engine/premium.js MAP_PREMIUM:`);
  console.log(`  ${profile}: ${disadvantaged}, // ${leadPct.toFixed(1)}% lean, generated ${process.env.STAMP ?? "gen_premium"}`);
}
