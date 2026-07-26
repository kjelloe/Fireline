// Count Wave-1 system events (drones, mines, manufacture, downs/rescues) in
// an AI-only war — do the new systems ever fire with pure regents?
import { GameServer } from "../engine/server.js";

const SEED = Number(process.env.SEED ?? 2026);
const TICKS = Number(process.env.TICKS ?? 12000);
const server = new GameServer({ mapSeed: SEED, enableAi: true, aiDifficulty: 1 });
const counts = {};
for (let i = 0; i < TICKS && server.state.phase === 0; i++) {
  const snap = server.step();
  for (const e of snap.views[0].events) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
  }
}
const interesting = Object.entries(counts)
  .filter(([t]) => /drone|mine|manufactur|downed|rescued|redeploy|delivered/.test(t))
  .sort();
console.log("seed", SEED, "ticks", server.state.tick);
console.log(interesting.length ? interesting : "no Wave-1 system events fired");
