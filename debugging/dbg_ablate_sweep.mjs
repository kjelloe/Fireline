// debugging/dbg_ablate_sweep.mjs — subsystem-ablation bisection for the
// riverline east edge: run N wars with one subsystem neutralized and see
// whether the B-side advantage survives. Whatever ablation kills the
// edge names the mechanism.
//   ABLATE=nowater|nopaths|nomines|nodrones node debugging/dbg_ablate_sweep.mjs 120
// Sharding: SHARDS/SHARD like sim_sweep.

import { GameServer } from "../engine/server.js";

const COUNT = Number(process.argv[2] ?? 60);
const ABLATE = process.env.ABLATE ?? "none";
const SHARDS = Number(process.env.SHARDS ?? 1);
const SHARD = Number(process.env.SHARD ?? 0);
const T_OPEN = 0;
const T_PATH = 5;
const T_WATER = 6;

let a = 0, b = 0, undecided = 0;
for (let seed = 1; seed <= COUNT; seed++) {
  if (seed % SHARDS !== SHARD) continue;
  const server = new GameServer({
    mapSeed: seed, enableAi: true, aiDifficulty: 1, mapProfile: "riverline",
  });
  const s = server.state;
  if (ABLATE === "nowater") {
    for (let i = 0; i < s.map.cells.length; i++) {
      if (s.map.cells[i] === T_WATER) s.map.cells[i] = T_OPEN;
    }
  } else if (ABLATE === "nopaths") {
    for (let i = 0; i < s.map.cells.length; i++) {
      if (s.map.cells[i] === T_PATH) s.map.cells[i] = T_OPEN;
    }
  } else if (ABLATE === "nomines") {
    for (const asset of s.assets) asset.minesLeft = 0;
  } else if (ABLATE === "nodrones") {
    for (const asset of s.assets) asset.campTicks = -1e9;
  }
  for (let i = 0; i < 18000 && server.state.phase === 0; i++) server.step();
  const w = server.state.winner;
  if (w === 0) a++; else if (w === 1) b++; else undecided++;
}
console.log(`${ABLATE}: A ${a} B ${b} undecided ${undecided}`);
