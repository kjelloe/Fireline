// ARTILLERY CENSUS (prompt 172). The mid-war ledger convicts B's
// artillery (14 centre kills v A's ~5 in the run window). Why does B's
// artillery dominate? Per 500-tick bucket and team: artillery hulls
// ALIVE, mean cell-x (advance from own edge), shots fired, kills, and
// deaths — plus the same for the counter-battery target (enemy arty
// hit by arty). POWS=2, 5 seeds.
import { GameServer } from "../engine/server.js";

const NB = 12;
const agg = Array.from({ length: NB }, () => ({
  alive: [0, 0], adv: [0, 0], n: [0, 0],
  shots: [0, 0], kills: [0, 0], deaths: [0, 0], cbKills: [0, 0],
}));

for (const seed of [2026, 777, 31337, 4242, 9001]) {
  const server = new GameServer({
    mapSeed: seed, enableAi: true, uniqueCrewing: true,
    rules: (process.env.POWS === "0" ? {} : { powPreplaced: 2 }),
  });
  for (let t = 0; t < 6000; t++) {
    server.step();
    const s = server.state;
    const b = agg[Math.min(NB - 1, Math.floor(s.tick / 500))];
    for (const a of s.assets) {
      if (a.type !== 2 || (a.team !== 0 && a.team !== 1)) continue;
      if (a.state === 2 || a.state === 3) continue;
      b.alive[a.team]++;
      b.adv[a.team] += a.team === 0 ? (a.x >> 8) - 7 : 120 - (a.x >> 8);
      b.n[a.team]++;
    }
    for (const e of s.events) {
      if (e.type === "fire_resolved") {
        const atk = s.assets[e.attackerId];
        if (atk?.type === 2 && (atk.team === 0 || atk.team === 1)) b.shots[atk.team]++;
      } else if (e.type === "asset_disabled") {
        const v = s.assets[e.assetId];
        if (!v || (v.team !== 0 && v.team !== 1)) continue;
        if (e.byType === 2) {
          b.kills[v.team === 0 ? 1 : 0]++;
          if (v.type === 2) b.cbKills[v.team === 0 ? 1 : 0]++; // counter-battery
        }
        if (v.type === 2) b.deaths[v.team]++;
      }
    }
  }
}

console.log("bucket  aliveA/B  advA/B   shotsA/B  killsA/B  cbA/B  arty-deathsA/B");
for (let i = 0; i < NB; i++) {
  const b = agg[i];
  const advA = b.n[0] ? (b.adv[0] / b.n[0]).toFixed(1) : "-";
  const advB = b.n[1] ? (b.adv[1] / b.n[1]).toFixed(1) : "-";
  console.log(
    `${String(i * 500).padStart(6)}  ${(b.alive[0] / 2500).toFixed(1)}/${(b.alive[1] / 2500).toFixed(1)}  ` +
    `${advA}/${advB}  ${String(b.shots[0]).padStart(4)}/${b.shots[1]}  ` +
    `${String(b.kills[0]).padStart(4)}/${b.kills[1]}  ${b.cbKills[0]}/${b.cbKills[1]}  ${b.deaths[0]}/${b.deaths[1]}`
  );
}
