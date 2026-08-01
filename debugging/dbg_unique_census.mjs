// Q60: the 16B ghost. Caldera leans 66-70% A with EITHER unique
// arrangement, and is dead fair with uniques off. So the pair's
// EXISTENCE hands team A something arrangement-independent. Census:
// per team — when the unique is first crewed, how long it lives, what
// it does (kills, anchor ticks, capture ticks), and who its CREW
// would otherwise be.
import { GameServer } from "../engine/server.js";
import { getUnitStats } from "../engine/units.js";

const N = Number(process.env.N ?? 10);
const MAP = process.env.MAP ?? "caldera";
const agg = {};
const bump = (k, t, v = 1) => { (agg[k] ??= [0, 0])[t] += v; };
for (let seed = 1; seed <= N; seed++) {
  const server = new GameServer({ mapSeed: seed, enableAi: true, mapProfile: MAP });
  const firstCrew = [-1, -1];
  for (let t = 0; t < 18000; t++) {
    server.step();
    const s = server.state;
    for (const team of [0, 1]) {
      const uid = team === 0 ? 18 : 30; // Sentinel / Skimmer garage ids
      const u = s.assets[uid];
      if (!u) continue;
      if (u.operatorId !== -1 && firstCrew[team] === -1) firstCrew[team] = s.tick;
      if (u.operatorId !== -1 && u.state !== 2 && u.state !== 3) bump("uniqueCrewedTicks", team);
      if (u.deployed === 1) bump("deployedTicks", team);
    }
    for (const e of s.events) {
      if (e.type === "asset_disabled" && e.byType !== undefined) {
        const killer = s.assets[e.by];
        if (killer && getUnitStats(killer.type).id >= 7 && killer.team >= 0) {
          bump("uniqueKills", killer.team);
        }
      }
    }
    if (s.winner !== -1) break;
  }
  if (server.state.winner >= 0) bump("wins", server.state.winner);
  bump("firstCrewSum", 0, firstCrew[0] === -1 ? 18000 : firstCrew[0]);
  bump("firstCrewSum", 1, firstCrew[1] === -1 ? 18000 : firstCrew[1]);
  process.stderr.write(".");
}
console.log("");
for (const [k, v] of Object.entries(agg)) {
  console.log(`${k.padEnd(18)} A=${String(v[0]).padStart(8)}  B=${String(v[1]).padStart(8)}`);
}
