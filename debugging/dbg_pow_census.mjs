// W4-8 measurement (owner: "let us measure and tune"). Do the four new
// creators actually grow prisoners in a STANDARD war (powPreplaced 0,
// where prisons have always sat empty)? Per team: captures by cause.
import { GameServer } from "../engine/server.js";
const agg = { 0: {}, 1: {} };
let wars = 0;
for (const seed of [2026, 777, 31337, 4242, 9001]) {
  const server = new GameServer({ mapSeed: seed, enableAi: true, uniqueCrewing: true });
  wars++;
  for (let t = 0; t < 12000; t++) {
    server.step();
    for (const e of server.state.events) {
      if (e.type !== "operator_captured") continue;
      const how = e.how ?? "scout_abduction";
      const victim = e.team === 0 ? 0 : 1;
      agg[victim][how] = (agg[victim][how] ?? 0) + 1;
    }
    if (server.state.phase === 1) break;
  }
}
console.log(`standard wars (powPreplaced 0), ${wars} seeds — captures by cause:`);
for (const team of [0, 1]) {
  const rows = Object.entries(agg[team]).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((n, [, v]) => n + v, 0);
  console.log(`  team ${team === 0 ? "A" : "B"} lost ${total}: ${rows.map(([k, v]) => `${k}=${v}`).join("  ") || "(none)"}`);
}
