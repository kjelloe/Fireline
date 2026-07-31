// POWS=2 mechanism hunt: WHERE does team B's edge come from? Per-team
// pipeline census across N seeds: designation ticks, party formation,
// dives, raids, springs, re-seats, raider deaths, defender pulls.
import { GameServer } from "../engine/server.js";

const N = Number(process.env.N ?? 10);
const agg = {};
const bump = (k, t, v = 1) => { (agg[k] ??= [0, 0])[t] += v; };
for (let seed = 1; seed <= N; seed++) {
  const server = new GameServer({ mapSeed: seed, enableAi: true, rules: { powPreplaced: 2 } });
  const reseated = new Set();
  for (let t = 0; t < 16000; t++) {
    server.step();
    const s = server.state;
    for (const team of [0, 1]) {
      const d = server.ai?.raidDebug?.[team];
      if (d && d.tick >= s.tick - 1 && d.opId !== -1) {
        bump("designatedTicks", team);
        if (d.phase === 1) bump("phase1Ticks", team);
        if (d.dive) bump("diveTicks", team);
        bump("escortSum", team, d.escorts ?? 0);
        // Closest approach: how near does the designated raider get?
        if (d.raiderCell) {
          const targetPrison = s.prisons.find((p) => p.team !== team);
          if (targetPrison) {
            const dist = Math.max(Math.abs(d.raiderCell[0] - targetPrison.cellX),
                                  Math.abs(d.raiderCell[1] - targetPrison.cellY));
            const key = `_best${team}`;
            agg[key] = Math.min(agg[key] ?? 999, dist);
            if (d.phase === 1) bump("advCells", team, dist); // mean advance distance
            // At the wire: who is home when the raider arrives?
            if (dist <= 3) {
              bump("atWireTicks", team);
              const defenders = s.assets.filter((a) =>
                a.team === targetPrison.team && a.operatorId !== -1 &&
                a.state !== 2 && a.state !== 3 &&
                Math.max(Math.abs(Math.floor(a.x / 256) - targetPrison.cellX),
                         Math.abs(Math.floor(a.y / 256) - targetPrison.cellY)) <= 5).length;
              bump("defendersAtWire", team, defenders);
              const escortsAlive = d.escorts ?? 0;
              bump("escortsAtWire", team, escortsAlive);
            }
          }
        }
      }
    }
    for (const e of s.events) {
      if (e.type === "prison_raided") bump("raids", e.team === 0 ? 1 : 0);
      if (e.type === "operator_captured") bump("captured", 1 - (e.team ?? 0));
      if (e.type === "pow_delivered") bump("delivered", e.team ?? 0);
      if (e.type === "pow_resecured") bump("resecured", e.team === 0 ? 1 : 0);
    }
    // Re-seat census: pre-placed captives back in a seat.
    for (const id of [26, 27, 30, 31]) {
      const o = s.operators[id];
      if (o.state === 1 && o.assetId !== -1 && !reseated.has(id)) {
        reseated.add(id);
        bump("reseated", o.team);
      }
    }
    // Wire census: whose raid clock actually RUNS, and how high.
    for (const p of s.prisons ?? []) {
      const raider = p.team === 0 ? 1 : 0;
      if (p.raidTicks > 0) bump("clockTicks", raider);
      if (p.raidTicks > (agg._max ??= [0, 0])[raider]) agg._max[raider] = p.raidTicks;
    }
    if (s.winner !== -1) break;
  }
  if (server.state.winner >= 0) bump("wins", server.state.winner);
  process.stderr.write(".");
}
console.log("");
console.log("bestDist raiderA=", agg._best0, " raiderB=", agg._best1,
  " meanAdvDist A=", Math.round((agg.advCells?.[0] ?? 0) / (agg.phase1Ticks?.[0] || 1)),
  " B=", Math.round((agg.advCells?.[1] ?? 0) / (agg.phase1Ticks?.[1] || 1)));
delete agg._max; delete agg._best0; delete agg._best1; delete agg.advCells;
for (const [k, v] of Object.entries(agg)) {
  console.log(`${k.padEnd(16)} A=${String(v[0]).padStart(7)}  B=${String(v[1]).padStart(7)}`);
}
