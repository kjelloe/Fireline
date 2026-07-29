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
const MAP = process.env.MAP || "frontier_corridor"; // 11M profiles
const DIFFICULTY = Number(process.env.DIFFICULTY ?? 1);
const MIRROR = process.env.MIRROR === "1";
const FACTIONSWAP = process.env.FACTIONSWAP === "1"; // 12D: uniques trade sides
const UNIQUES = process.env.UNIQUES !== "0"; // 16B: unique crewing (DEFAULT ON since prompt-54; 0 disables)
const SHARDS = Number(process.env.SHARDS ?? 1);
const SHARD = Number(process.env.SHARD ?? 0);
const HORIZON = Number(process.env.TICKS ?? 18000);

console.log("seed,mirror,difficulty,ticks,winner,reason,scoreA,scoreB,tows,restored,rescued,downs,mines,detonations,captures,shells");
if (FACTIONSWAP) console.error("factionswap: Sentinel<->Skimmer sides traded");
for (let seed = 1; seed <= COUNT; seed++) {
  if (seed % SHARDS !== SHARD) continue;
  const server = new GameServer({
    mapSeed: seed, enableAi: true, aiDifficulty: DIFFICULTY, aiMirrored: MIRROR,
    mapProfile: MAP, uniqueCrewing: UNIQUES,
  });
  if (MIRROR) {
    // TRUE world reflection (question 18): mirror the terrain and every
    // entity across x' = W-1-x, headings across the vertical axis, and
    // the AI patrols swap sides (aiMirrored). In a bias-free engine the
    // outcome distribution must be the exact flip of the normal run;
    // any residue that survives reflection is directional arithmetic.
    // MPG rebuilds are base-derived since the collision battery exposed
    // the old constant-table caveat — mirrored worlds rebuild honestly.
    const s = server.state;
    const W = s.map.width;
    const cells = s.map.cells;
    for (let y = 0; y < s.map.height; y++) {
      for (let x = 0; x < W / 2; x++) {
        const a = y * W + x;
        const b = y * W + (W - 1 - x);
        const t = cells[a]; cells[a] = cells[b]; cells[b] = t;
      }
    }
    // MIRROR TRANSFORM: reflect about the map's true centre line
    // (x = W*256/2), i.e. x' = W*256 - x. Entities sit at cell CENTRES
    // (cellToWorld(c) = c*256+128), and this maps the centre of cell c
    // onto the centre of cell W-1-c EXACTLY, for every cell — which is
    // what makes a mirrored world a true mirror.
    //
    // History: (W-1)*256 - x was anchor-preserving about cell centres
    // and sent the east edge off the map; (W*256-1) - x was the right
    // reflection for the OLD left-edge convention but landed one unit
    // short of a centre. Both are wrong now. See specs/08 §4.
    const mx = (worldX) => W * 256 - worldX;
    for (const a of s.assets) {
      a.x = mx(a.x); a.targetX = mx(a.targetX);
      a.heading = (128 - a.heading) & 255;
    }
    for (const st of s.standards) {
      st.x = mx(st.x);
      st.homeCellX = W - 1 - st.homeCellX;
    }
    for (const site of s.sites) site.cellX = W - 1 - site.cellX;
    for (const b of s.bases) b.x = W - b.x - b.width;
  }
  if (FACTIONSWAP) {
    // 12D: the faction-unique pair trades sides — asset 18 (Directorate
    // Sentinel) becomes a Skimmer, asset 30 becomes a Sentinel. Everything
    // else is mirror-symmetric, so any win-rate shift that does NOT track
    // the swap is chassis imbalance, not side or seed luck.
    server.state.assets[18].type = 8;
    server.state.assets[30].type = 7;
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
