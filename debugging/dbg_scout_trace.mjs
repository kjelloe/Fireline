// The scout question (prompt 169): WHY are B's scouts 3x deadlier?
// For every scout-involved engagement, count FIRST SHOTS by team, the
// global-tick phase at the shot (reload 8 -> window = tick % 16), and
// scout-vs-scout duel outcomes. 5 seeds, POWS=0 (the clean config).
import { GameServer } from "../engine/server.js";
import { getUnitStats } from "../engine/units.js";

const first = { 0: 0, 1: 0 };       // first shot of a fresh pairing, by shooter team
const phase = { 0: [0, 0], 1: [0, 0] }; // shots in window-half 0/1 by team
const duels = { 0: 0, 1: 0 };
const bands = { 0: [0, 0, 0], 1: [0, 0, 0] };
const rows = { 0: [0, 0, 0], 1: [0, 0, 0] };       // scout-vs-scout disables won, by killer team
for (const seed of [2026, 777, 31337, 4242, 9001]) {
  const server = new GameServer({ mapSeed: seed, enableAi: true, uniqueCrewing: true });
  const seen = new Set(); // pairing keys with a shot already
  for (let t = 0; t < 12000; t++) {
    server.step();
    const s = server.state;
    for (const e of s.events) {
      if (e.type === "fire_resolved") {
        const atk = s.assets[e.attackerId];
        const tgt = s.assets[e.targetId];
        if (!atk || !tgt) continue;
        const scoutInvolved = atk.type === 1 || tgt.type === 1;
        if (!scoutInvolved) continue;
        if (atk.type === 1) {
          phase[atk.team][(s.tick % 16) < 8 ? 0 : 1]++;
          const col = atk.x >> 8;
          bands[atk.team][col < 43 ? 0 : col < 85 ? 1 : 2]++;
          rows[atk.team][(atk.y >> 8) < 43 ? 0 : (atk.y >> 8) < 85 ? 1 : 2]++;
        }
        const key = `${Math.min(e.attackerId, e.targetId)}-${Math.max(e.attackerId, e.targetId)}-${Math.floor(s.tick / 200)}`;
        if (!seen.has(key)) { seen.add(key); first[atk.team]++; }
      }
      if (e.type === "asset_disabled" && e.byType === 1) {
        const victim = s.assets[e.assetId];
        if (victim?.type === 1) duels[victim.team === 0 ? 1 : 0]++;
      }
    }
    if (s.phase === 1) break;
  }
}
console.log("first shots in scout engagements, by shooter team:", JSON.stringify(first));
console.log("scout shots by window half (tick%16 <8 / >=8):", JSON.stringify(phase));
console.log("scout-vs-scout duel wins by team:", JSON.stringify(duels));
console.log("scout shots by column band W/C/E:", JSON.stringify(bands));
console.log("scout shots by row band N/C/S:", JSON.stringify(rows));
