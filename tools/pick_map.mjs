// tools/pick_map.mjs — interactive map picker (prompt 76).
//
//   npm run pick
//
// Lists the registered profiles with a one-line identity, asks which,
// then execs the server with that map. Reads the REAL registry, so a new
// profile appears here the moment it is registered — no list to update.

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mapProfileNames } from "../engine/state.js";

// Identity blurbs are presentation only; an unknown profile still lists,
// it just has no description yet.
const BLURB = {
  frontier_corridor: "the default - open corridor, 8-relay lane + lateral web",
  riverline: "a river with three DROPPABLE bridges (experimental)",
  blackwood: "dense woodland, the fight leaves the road (experimental)",
  sawtooth: "canyon lanes behind impassable mesas (experimental)",
};

const names = mapProfileNames();
console.log("\nFireline Command - pick a map\n");
names.forEach((n, i) => {
  console.log(`  ${i + 1}) ${n.padEnd(20)} ${BLURB[n] ?? ""}`);
});
console.log("");

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question(`choice [1-${names.length}, default 1]: `, (answer) => {
  rl.close();
  const raw = answer.trim();
  let chosen;
  if (raw === "") {
    chosen = names[0];
  } else if (/^\d+$/.test(raw)) {
    const idx = Number(raw) - 1;
    if (idx < 0 || idx >= names.length) {
      console.error(`no such choice: ${raw}`);
      process.exit(2);
    }
    chosen = names[idx];
  } else if (names.includes(raw)) {
    chosen = raw; // typing the name works too
  } else {
    console.error(`no such map: ${raw}\n  available: ${names.join(", ")}`);
    process.exit(2);
  }
  console.log(`\nstarting ${chosen}...\n`);
  // exec rather than import: the server owns its own lifecycle, signals
  // and shutdown, and this stays a launcher instead of a second entry.
  const child = spawn(process.execPath, ["server/index.js", "--map", chosen], {
    stdio: "inherit",
  });
  child.on("exit", (code) => process.exit(code ?? 0));
});
