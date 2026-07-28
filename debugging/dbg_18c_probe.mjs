// debugging/dbg_18c_probe.mjs — 18C: WHY is sawtooth horn-bound?
// Two candidate mechanisms for "tickets never end a war":
//   (a) the relay split never reaches the majority (4 of 6) at all, or
//   (b) it reaches it in bursts too short to drain a 300 pool.
// Also reports whether a capturer is ever DESIGNATED for an enemy-held
// relay (CAPTURE_SEEK_CELLS = 16 Manhattan — patrols that never come
// within 16 of a contested relay can't generate pressure at all).
//
//   MAP=sawtooth node debugging/dbg_18c_probe.mjs

import { GameServer } from "../engine/server.js";
import { CAPTURE_SEEK_CELLS } from "../engine/ai_regency.js";
import { worldToCellFloor } from "../shared/fixedmath.js";
import { getUnitStats } from "../engine/units.js";

const MAP = process.env.MAP || "sawtooth";
const SEEDS = (process.env.SEEDS || "1,2,3,4,5").split(",").map(Number);
const HORIZON = Number(process.env.TICKS || 18000);

console.log(`profile=${MAP} seek=${CAPTURE_SEEK_CELLS} horizon=${HORIZON}\n`);

for (const seed of SEEDS) {
  const server = new GameServer({ mapSeed: seed, enableAi: true, aiDifficulty: 1 });
  // GameServer takes the profile by option name used elsewhere in tools.
  const s0 = new GameServer({ mapSeed: seed, enableAi: true, aiDifficulty: 1, mapProfile: MAP });
  const war = s0;
  const holdHist = new Map();   // owned-count -> ticks, per team
  let majorityTicks = [0, 0];
  let longestRun = [0, 0];
  let run = [0, 0];
  // Can either team even SEE an enemy relay as capturable?
  let reachTicks = [0, 0];
  const flips = new Map();
  const lastOwner = new Map();

  for (let i = 0; i < HORIZON && war.state.phase === 0; i++) {
    war.step();
    const st = war.state;
    for (const site of st.sites) {
      if (lastOwner.get(site.id) !== site.owner) {
        if (lastOwner.has(site.id)) flips.set(site.id, (flips.get(site.id) ?? 0) + 1);
        lastOwner.set(site.id, site.owner);
      }
    }
    const majority = Math.min(st.rules?.ticketMajority ?? 5, ((st.sites.length / 2) | 0) + 1);
    const owned = [0, 0];
    for (const site of st.sites) if (site.owner === 0 || site.owner === 1) owned[site.owner] += 1;
    for (const team of [0, 1]) {
      holdHist.set(`${team}:${owned[team]}`, (holdHist.get(`${team}:${owned[team]}`) ?? 0) + 1);
      if (owned[team] >= majority) {
        majorityTicks[team] += 1;
        run[team] += 1;
        if (run[team] > longestRun[team]) longestRun[team] = run[team];
      } else run[team] = 0;
    }
    // Sample capture-seek reachability every 50 ticks (cheap enough).
    if (i % 50 === 0) {
      for (const team of [0, 1]) {
        let reaches = false;
        for (const site of st.sites) {
          if (site.owner === team) continue;
          for (const a of st.assets) {
            if (a.team !== team || a.state === 2 || a.state === 3) continue;
            const stats = getUnitStats(a.type);
            if (!stats.canCapture || stats.deployable) continue;
            const d = Math.abs(site.cellX - worldToCellFloor(a.x)) +
                      Math.abs(site.cellY - worldToCellFloor(a.y));
            if (d <= CAPTURE_SEEK_CELLS) { reaches = true; break; }
          }
          if (reaches) break;
        }
        if (reaches) reachTicks[team] += 1;
      }
    }
  }
  const st = war.state;
  const samples = Math.ceil(st.tick / 50);
  const dist = (team) => [0, 1, 2, 3, 4, 5, 6, 7, 8]
    .filter((n) => holdHist.has(`${team}:${n}`))
    .map((n) => `${n}:${((holdHist.get(`${team}:${n}`) / st.tick) * 100).toFixed(0)}%`)
    .join(" ");
  console.log(`seed ${seed}: ticks ${st.tick} winner ${st.winner ?? -1} reason ${st.victoryReason ?? "-"} tickets ${st.tickets}`);
  console.log(`  A holds ${dist(0)}   | majority ${(majorityTicks[0] / st.tick * 100).toFixed(0)}% longest run ${longestRun[0]}`);
  console.log(`  B holds ${dist(1)}   | majority ${(majorityTicks[1] / st.tick * 100).toFixed(0)}% longest run ${longestRun[1]}`);
  console.log(`  capture-seek reaches an enemy relay: A ${(reachTicks[0] / samples * 100).toFixed(0)}% of samples, B ${(reachTicks[1] / samples * 100).toFixed(0)}%`);
  console.log(`  per-site: ${st.sites.map((s) => `(${s.cellX},${s.cellY})=${s.owner}${flips.get(s.id) ? `/${flips.get(s.id)}x` : ""}`).join(" ")}\n`);
}
