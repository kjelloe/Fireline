// Which TEAM does the POW-arc damage in default wars? Per-team census
// of captures / deliveries / raids / springs across N seeds.
import { GameServer } from "../engine/server.js";

const N = Number(process.env.N ?? 10);
const tot = {
  cap: [0, 0], deliv: [0, 0], raids: [0, 0], freed: [0, 0], wins: [0, 0],
};
for (let seed = 1; seed <= N; seed++) {
  const server = new GameServer({ mapSeed: seed, enableAi: true });
  for (let t = 0; t < 18000; t++) {
    server.step();
    const s = server.state;
    for (const e of s.events) {
      // operator_captured: victim seat's team is e.team? use captor side
      // via the scout: byTeam if present; else infer from prison later.
      if (e.type === "operator_captured" && e.byTeam !== undefined) tot.cap[e.byTeam] += 1;
      else if (e.type === "operator_captured") tot.cap[1 - (e.team ?? 0)] += 1;
      if (e.type === "pow_delivered") tot.deliv[e.team ?? 0] += 1;
      if (e.type === "prison_raided") {
        const raider = e.team === 0 ? 1 : 0; // prison owner's enemy
        tot.raids[raider] += 1;
        tot.freed[raider] += e.freed ?? 0;
      }
    }
    if (s.winner !== -1) break;
  }
  if (server.state.winner >= 0) tot.wins[server.state.winner] += 1;
  process.stderr.write(".");
}
console.log(`\nn=${N}: wins A/B ${tot.wins}  captures(by) ${tot.cap}  deliveries(by) ${tot.deliv}  raids(by) ${tot.raids}  freed(by) ${tot.freed}`);
