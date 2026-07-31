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
    if (s.winner !== -1) break;
  }
  if (server.state.winner >= 0) bump("wins", server.state.winner);
  process.stderr.write(".");
}
console.log("");
for (const [k, v] of Object.entries(agg)) {
  console.log(`${k.padEnd(16)} A=${String(v[0]).padStart(7)}  B=${String(v[1]).padStart(7)}`);
}
