// POWS hunt round 3: WHAT HAPPENS to prison-party escorts? Per team:
// died (where, killed by what) vs re-designated away vs pool-starved.
import { GameServer } from "../engine/server.js";

const N = Number(process.env.N ?? 10);
const agg = { died: [0, 0], reassigned: [0, 0], starvedTicks: [0, 0] };
const deathCells = [[], []];
for (let seed = 1; seed <= N; seed++) {
  const server = new GameServer({ mapSeed: seed, enableAi: true, rules: { powPreplaced: 2 } });
  const prev = [new Set(), new Set()];
  for (let t = 0; t < 16000; t++) {
    server.step();
    const s = server.state;
    const disabledNow = new Set(
      s.events.filter((e) => e.type === "asset_disabled").map((e) => e.assetId));
    for (const team of [0, 1]) {
      const d = server.ai?.raidDebug?.[team];
      if (!d || d.tick < s.tick - 1 || d.opId === -1) { prev[team] = new Set(); continue; }
      const cur = new Set((d.escortCells ? [] : []));
      // escorts list isn't in raidDebug — use designated count + op tracking via plan? Fallback:
      // reconstruct from ai internals is unavailable; use escorts count transitions.
      const n = d.escorts ?? 0;
      if (n === 0 && d.phase === 1) agg.starvedTicks[team] += 1;
      prev[team] = cur;
    }
    // Death census: any asset disabled this tick within the lane band
    // (rows 73-81) mid-map (x 30-98) — the party corridor.
    for (const e of s.events) {
      if (e.type !== "asset_disabled") continue;
      const a = s.assets[e.assetId];
      if (!a) continue;
      const cx = Math.floor(a.x / 256), cy = Math.floor(a.y / 256);
      if (a.team >= 0 && cy >= 73 && cy <= 81 && cx >= 25 && cx <= 102) {
        agg.died[a.team] += 1;
        deathCells[a.team].push(cx);
      }
    }
    if (s.winner !== -1) break;
  }
  process.stderr.write(".");
}
console.log("");
console.log("lane-corridor deaths: A=", agg.died[0], " B=", agg.died[1]);
console.log("phase1 starved (0 escorts) ticks: A=", agg.starvedTicks[0], " B=", agg.starvedTicks[1]);
const hist = (cells) => {
  const h = {};
  for (const x of cells) h[Math.floor(x / 10) * 10] = (h[Math.floor(x / 10) * 10] ?? 0) + 1;
  return Object.entries(h).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}s:${v}`).join(" ");
};
console.log("A death x-hist:", hist(deathCells[0]));
console.log("B death x-hist:", hist(deathCells[1]));
