// Regenerate data/units.json — the pinned mirror of engine/units.js
// UNIT_STATS (test 3A). Run after ANY units.js stats change.
import { writeFileSync } from "node:fs";
import { UNIT_STATS } from "../engine/units.js";

writeFileSync(new URL("../data/units.json", import.meta.url),
  JSON.stringify({ units: JSON.parse(JSON.stringify(UNIT_STATS)) }, null, 2) + "\n");
console.log("data/units.json regenerated");
