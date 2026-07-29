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
    // MIRROR TRANSFORM (fixed 2026-07-30). It used to be
    //   (W - 1) * 256 - x
    // which is an ANCHOR-PRESERVING reflection about cell CENTRES: it is
    // correct only for exact cell centres, maps every other position one
    // cell too far west, and sends the map's east edge (32767) to -255 —
    // off the map. Every mirrored run therefore measured a world that was
    // NOT the mirror of the normal one, which is enough to manufacture a
    // "side lean" out of terrain the unit never actually stood on.
    // The world spans 0..W*256-1, so the reflection is (W*256-1) - x.
    // MIRROR TRANSFORM. The world spans 0..W*256-1, so the reflection is
    // (W*256-1) - x. This is the mathematically correct one: it is an
    // involution, never leaves the map, and maps cell c to cell W-1-c for
    // EVERY position. (The original, (W-1)*256 - x, put any mid-cell
    // position one cell too far west and sent the east edge to -255.)
    //
    // NOTE, and it matters for how mirror results are read: exact
    // equivariance is UNREACHABLE while entities sit on cell LEFT EDGES
    // (cellToWorld(c) = c*256). A left edge does not reflect onto a left
    // edge, so a mirrored world starts up to 255 units (~1 cell) out of
    // step with the normal one, and AI targets - which are always
    // cell-aligned - do not reflect onto each other either. Mirror
    // sweeps therefore carry a <=1-cell artifact, which is the residue
    // specs/08 §4 recorded. Removing it means cell-CENTRED positions
    // (c*256+128), which mirror onto each other exactly - an engine
    // change with a fixture repin, not a harness tweak.
    const mx = (worldX) => (W * 256 - 1) - worldX;
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
