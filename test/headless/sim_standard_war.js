// test/headless/sim_standard_war.js — backend standard-war simulation:
// AI agents ONLY, full objective doctrine, run until game over or budget.
// Built for the Carrier-exclusive carrying evaluation (dev-prompts prompt 12):
// change the carrying rule, rerun, compare outcomes.
// Usage: npm run simwar  (env: SEED, TICKS, DIFFICULTY)

import { GameServer } from "../../engine/server.js";
import { createInitialState } from "../../engine/reducer.js";
import { replayLog } from "../../engine/replay.js";
import { hashState } from "../../engine/snapshot.js";

const SEED = Number(process.env.SEED ?? 2026);
const TICKS = Number(process.env.TICKS ?? 12000);
const DIFFICULTY = Number(process.env.DIFFICULTY ?? 1);
// MAP= was silently IGNORED here until 2026-07-31 — every "per-profile
// 5-seed gate" run through sim_campaign_wave1.sh actually gated frontier.
// The 30+30 sim_sweep runs always honoured MAP, so sweep-based verdicts
// stand; gate-based per-map claims from before this line do not.
const MAP = process.env.MAP || "frontier_corridor";

const server = new GameServer({ mapSeed: SEED, enableAi: true, aiDifficulty: DIFFICULTY, mapProfile: MAP });
const timeline = [];
const WATCHED = new Set([
  "standard_taken", "standard_dropped", "standard_returned", "standard_scored",
  "site_captured", "asset_disabled", "game_over",
]);

for (let i = 0; i < TICKS && server.state.phase === 0; i++) {
  const snap = server.step();
  for (const e of snap.views[0].events) {
    if (WATCHED.has(e.type)) timeline.push({ tick: snap.tick, ...e });
  }
}

for (const entry of timeline) {
  const { tick, type, ...rest } = entry;
  console.log(String(tick).padStart(6), type.padEnd(18), JSON.stringify(rest));
}

const s = server.state;
console.log("\nseed", SEED, "| difficulty", DIFFICULTY, "| ticks", s.tick,
  "| phase", s.phase === 1 ? "OVER" : "running");
console.log("winner:", s.winner, "| reason:", s.winReason, "| scores:", s.teamScores);
console.log("standards:", s.standards.map((st) => ({ team: st.team, status: st.status, carrier: st.carrierAssetId })));

const replayed = replayLog(createInitialState(SEED, "frontier_corridor"), server.commandLog);
const ok = hashState(replayed) === server.getLatestSnapshot().stateHash;
console.log(ok ? "REPLAY OK" : "REPLAY MISMATCH");
if (!ok) process.exit(1);
