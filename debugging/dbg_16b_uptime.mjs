// dbg_16b_uptime.mjs v2 — unique-chassis telemetry on the CURRENT base
// (routing + collision + tickets). Per team: unique crew/deploy time,
// relay-anchoring time, recoverer identity, and outcome. The A-side
// residue (~65% aggregate) hides in one of these columns.
import { GameServer } from "../engine/server.js";
import { getUnitStats } from "../engine/units.js";
const N = Number(process.argv[2] ?? 12);
const C = 256;
console.log("seed,winner,reason,crewA,crewB,deploy18,anchorA,anchorB,recovIsUniqueA,recovIsUniqueB");
for (let seed = 1; seed <= N; seed++) {
  const server = new GameServer({ mapSeed: seed, enableAi: true, uniqueCrewing: true });
  const crew = { 18: 0, 30: 0 };
  const anchor = { 18: 0, 30: 0 };
  let deploy18 = 0;
  const recovUnique = { 0: 0, 1: 0 };
  for (let t = 0; t < 18000; t++) {
    server.step();
    const s = server.state;
    for (const id of [18, 30]) {
      const a = s.assets[id];
      if (a.state === 2 || a.state === 3) continue;
      if (a.operatorId !== -1) crew[id]++;
      const ax = a.x / C | 0, ay = a.y / C | 0;
      if (s.sites.some((site) => site.owner === a.team &&
          Math.max(Math.abs(site.cellX - ax), Math.abs(site.cellY - ay)) <= 3)) anchor[id]++;
    }
    if (s.assets[18].deployed === 1) deploy18++;
    // Fastest-crewed-seat recoverer approximation per team:
    if (t % 100 === 0) {
      for (const team of [0, 1]) {
        let best = null, bestSpeed = -1;
        for (const a of s.assets) {
          if (a.team !== team || a.operatorId === -1 || a.state === 2 || a.state === 3) continue;
          const sp = getUnitStats(a.type).speed;
          if (sp > bestSpeed) { bestSpeed = sp; best = a; }
        }
        if (best && (best.id === 18 || best.id === 30)) recovUnique[team]++;
      }
    }
    if (s.phase !== 0) break;
  }
  const s = server.state;
  console.log([seed, s.winner, s.winReason, crew[18], crew[30], deploy18,
    anchor[18], anchor[30], recovUnique[0], recovUnique[1]].join(","));
}
