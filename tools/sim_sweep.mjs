// tools/sim_sweep.mjs — batch balance sweep for a dedicated machine.
// Runs N full AI-vs-AI wars (to game_over or the 18000-tick horn) and
// emits one CSV row per war. CPU-bound, single-threaded per process:
// shard across cores with the SHARD/SHARDS env vars.
//
//   node tools/sim_sweep.mjs 100                     # seeds 1..100
//   MIRROR=1 node tools/sim_sweep.mjs 100            # same seeds, teams swapped
//   DIFFICULTY=2 node tools/sim_sweep.mjs 100        # hard AI
//   SHARDS=6 SHARD=0 node tools/sim_sweep.mjs 600    # shard 0 of 6
//
// MIRROR=1 answers question 18 (residual geometry bias): a fair engine
// should show winner rates that flip with the mirror; a bias that
// survives mirroring lives in doctrine/order-of-execution, one that flips
// lives in map/fixedmath geometry.

import { GameServer } from "../engine/server.js";

const COUNT = Number(process.argv[2] ?? 20);
const DIFFICULTY = Number(process.env.DIFFICULTY ?? 1);
const MIRROR = process.env.MIRROR === "1";
const SHARDS = Number(process.env.SHARDS ?? 1);
const SHARD = Number(process.env.SHARD ?? 0);
const HORIZON = Number(process.env.TICKS ?? 18000);

console.log("seed,mirror,difficulty,ticks,winner,reason,scoreA,scoreB,tows,restored,rescued,downs,mines,detonations,captures,shells");
for (let seed = 1; seed <= COUNT; seed++) {
  if (seed % SHARDS !== SHARD) continue;
  const server = new GameServer({ mapSeed: seed, enableAi: true, aiDifficulty: DIFFICULTY });
  if (MIRROR) {
    // Swap the two teams' assets/operators in place: same map, sides traded.
    for (const a of server.state.assets) a.team = a.team === 0 ? 1 : 0;
    for (const o of server.state.operators) if (o.team !== -1) o.team = o.team === 0 ? 1 : 0;
    for (const st of server.state.standards) st.team = st.team === 0 ? 1 : 0;
    for (const b of server.state.bases) b.team = b.team === 0 ? 1 : 0;
  }
  const c = {};
  for (let i = 0; i < HORIZON && server.state.phase === 0; i++) {
    server.step();
    for (const e of server.state.events) c[e.type] = (c[e.type] ?? 0) + 1;
  }
  const s = server.state;
  console.log([
    seed, MIRROR ? 1 : 0, DIFFICULTY, s.tick, s.winner, s.winReason,
    s.teamScores[0], s.teamScores[1],
    c.tow_started ?? 0, c.asset_restored ?? 0, c.operator_rescued ?? 0,
    c.operator_downed ?? 0, c.mine_deployed ?? 0, c.mine_detonated ?? 0,
    c.site_captured ?? 0, c.site_shelled ?? 0,
  ].join(","));
}
