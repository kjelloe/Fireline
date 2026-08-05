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
import { createWarMetrics, METRIC_COLUMNS } from "./war_metrics.mjs";

const COUNT = Number(process.argv[2] ?? 20);
const MAP = process.env.MAP || "frontier_corridor"; // 11M profiles
const DIFFICULTY = Number(process.env.DIFFICULTY ?? 1);
const MIRROR = process.env.MIRROR === "1";
const FACTIONSWAP = process.env.FACTIONSWAP === "1"; // 12D: uniques trade sides
const UNIQUES = process.env.UNIQUES !== "0"; // 16B: unique crewing (DEFAULT ON since prompt-54; 0 disables)
const SHARDS = Number(process.env.SHARDS ?? 1);
const SHARD = Number(process.env.SHARD ?? 0);
const HORIZON = Number(process.env.TICKS ?? 18000);
// prompt-88 pool probes: TICKETPOOL=350 overrides the session rule so
// the designer's 330/350/375 candidates can be swept without a code edit.
const TICKETPOOL = process.env.TICKETPOOL ? Number(process.env.TICKETPOOL) : null;
// Q46 battery: POWS=2 pre-places captives (the designed POW experience)
// so the flip of the powPreplaced default can be judged at n=300.
const POWS = process.env.POWS ? Number(process.env.POWS) : null;
// Convoy Escort battery: MODE=convoy, MODEATTACKER=0|1 picks the side.
const MODE = process.env.MODE === "convoy" ? 1 : process.env.MODE === "heist" ? 2 : null;
const MODEATTACKER = process.env.MODEATTACKER === "1" ? 1 : 0;
// Bisection kill-switches (A/B only): RAIDPARTY=0 disables the AI
// prison-party doctrine; POWARC=0 disables scout captures entirely.
const RAIDPARTY = process.env.RAIDPARTY !== "0";
const POWARC = process.env.POWARC !== "0";
const ALARMRESPONSE = process.env.ALARMRESPONSE !== "0";
const RAIDERCLAUSE = process.env.RAIDERCLAUSE !== "0"; // Q31 clause kill-switch (caldera hunt)
const LANDSHIP = process.env.LANDSHIP !== "0"; // Q42 hull kill-switch (the A-keyed hunt)
const STALEMATE = process.env.STALEMATE !== "0"; // prompt-136 grind kill-switch (the Q69 rung)
const DROPS = process.env.DROPS !== "0"; // B6 circle kill-switch (residue rung)
const VAULTS = process.env.VAULTS !== "0"; // 0 strips kind-4 sites pre-war
const ORDERPARITY = process.env.ORDERPARITY === "1"; // Q71 trial: tick-parity command order
const CACHE = process.env.CACHE !== "0";
const SMOKE = process.env.SMOKE !== "0"; // W4-6 kill-switch
const CVPENALTY = process.env.CVPENALTY ? Number(process.env.CVPENALTY) : null; // Q82 ladder
const GETAWAY = process.env.GETAWAY !== "0"; // Q70 heist getaway-car experiment
const SIEGE = process.env.SIEGE !== "0"; // Q72 heist siege-prep switch
const LANDSHIPAI = process.env.LANDSHIPAI === "1"; // Q56 trial: regents may claim the fortress
// D+C (prompt 154): HANDICAP=0 disables the measured ticket offset;
// HANDICAP=<n> overrides the table amount (the ladder's knob).
const HANDICAP = process.env.HANDICAP ?? null;
const SLIDE = process.env.SLIDE !== "0"; // merged-hunt: enemy-slide A/B
// Band retune (2026-07-31): SKIMTRAIL=384 ladders the ruled Skimmer
// trail-speed lever the same way. Set once, before any war is built.
import { setPathSpeedAmphibious } from "../engine/terrain.js";
if (process.env.SKIMTRAIL) setPathSpeedAmphibious(Number(process.env.SKIMTRAIL));

// prompt-88: story columns appended AFTER the legacy ones, so positional
// consumers (the worker's summary awk, old analysis snippets) keep
// working and DictReader consumers pick the new names up by header.
console.log("seed,mirror,difficulty,ticks,winner,reason,scoreA,scoreB,tows,restored,rescued,downs,mines,detonations,captures,shells," + METRIC_COLUMNS.join(","));
if (FACTIONSWAP) console.error("factionswap: Sentinel<->Skimmer sides traded");
for (let seed = 1; seed <= COUNT; seed++) {
  if (seed % SHARDS !== SHARD) continue;
  const server = new GameServer({
    mapSeed: seed, enableAi: true, aiDifficulty: DIFFICULTY, aiMirrored: MIRROR,
    mapProfile: MAP, uniqueCrewing: UNIQUES, raidParty: RAIDPARTY,
    alarmResponse: ALARMRESPONSE, orderParity: ORDERPARITY,
    rules: TICKETPOOL || POWS !== null || MODE !== null || !POWARC || !RAIDERCLAUSE || !LANDSHIP || !STALEMATE || !DROPS || !CACHE || !GETAWAY || !SIEGE || LANDSHIPAI || HANDICAP !== null || !SLIDE || !SMOKE || CVPENALTY !== null
      ? { ...(TICKETPOOL ? { ticketPool: TICKETPOOL } : {}),
          ...(POWS !== null ? { powPreplaced: POWS } : {}),
          ...(SMOKE ? {} : { smoke: false }),
          ...(CVPENALTY !== null ? { convoyDefenderPenalty: CVPENALTY } : {}),
          ...(MODE !== null ? { mode: MODE, modeAttacker: MODEATTACKER } : {}),
          ...(!POWARC ? { powArc: false } : {}),
          ...(!RAIDERCLAUSE ? { raiderClause: false } : {}),
          ...(!LANDSHIP ? { landship: false } : {}),
          ...(!STALEMATE ? { stalemateBleedTicks: 0 } : {}),
          ...(!DROPS ? { drops: false } : {}),
          ...(!CACHE ? { cacheAura: false } : {}),
          ...(!GETAWAY ? { heistGetaway: false } : {}),
          ...(!SIEGE ? { heistSiege: false } : {}),
          ...(LANDSHIPAI ? { landshipAI: true } : {}),
          ...(HANDICAP === "0" ? { handicap: false }
            : HANDICAP !== null ? { handicapTickets: Number(HANDICAP) } : {}),
          ...(!SLIDE ? { enemySlide: false } : {}) }
      : null,
  });
  // Config-plumbing self-check (the crewing-bug lesson): say what the
  // FIRST war actually starts with, so a mis-wired rules object can
  // never masquerade as a null result at n=300.
  if (POWS !== null && seed === 1) {
    const captive = server.state.operators.filter((o) => o.state === 3).length;
    console.error(`pows: powPreplaced=${POWS} -> ${captive} captive seats at tick 0`);
  }
  if (MODE !== null && seed === 1) {
    console.error(`mode: convoy attacker=${MODEATTACKER} mission=${JSON.stringify(server.state.mission)}`);
  }
  if (!VAULTS) {
    // Bisection rung: the vault pair never existed (sites 10 -> 8).
    server.state.sites = server.state.sites.filter((st) => st.kind !== 4);
  }
  if (process.env.VAULTS === "2") {
    // Reinstate rung: the PULLED frontier vault pair returns for this
    // run only — measured against fixed prisons to test whether the
    // north-trail chirality shared the unmirrored-prison root.
    const nextId = server.state.sites.length;
    server.state.sites.push(
      { id: nextId, type: 1, owner: -1, kind: 4, cellX: 58, cellY: 40, captureProgress: 0, capturingTeam: -1, hp: 60 },
      { id: nextId + 1, type: 1, owner: -1, kind: 4, cellX: 69, cellY: 40, captureProgress: 0, capturingTeam: -1, hp: 60 });
  }
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
    // PRISONS were forgotten here for four days: mirror worlds ran with
    // every compound at its UNMIRRORED cell — inside the wrong base —
    // and the mirror batteries measured a different game (614 raids vs
    // 128; captures 315 vs 34). Any mirror-sweep POW read from before
    // this line is void.
    for (const p of s.prisons ?? []) p.cellX = W - 1 - p.cellX;
    if (s.mission) s.mission.gateCellX = W - 1 - s.mission.gateCellX;
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
  const metrics = createWarMetrics(); // prompt-88 story instrument
  for (let i = 0; i < HORIZON && server.state.phase === 0; i++) {
    server.step();
    metrics.observe(server.state);
    for (const e of server.state.events) c[e.type] = (c[e.type] ?? 0) + 1;
  }
  const story = metrics.finish(server.state);
  const s = server.state;
  console.log([
    seed, MIRROR ? 1 : 0, DIFFICULTY, s.tick, s.winner, s.winReason,
    s.teamScores[0], s.teamScores[1],
    c.tow_started ?? 0, c.asset_restored ?? 0, c.operator_rescued ?? 0,
    c.operator_downed ?? 0, c.mine_deployed ?? 0, c.mine_detonated ?? 0,
    c.site_captured ?? 0, c.site_shelled ?? 0,
    ...METRIC_COLUMNS.map((k) => story[k]),
  ].join(","));
}
