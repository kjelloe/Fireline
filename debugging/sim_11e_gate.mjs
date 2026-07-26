// 11E sim gate (Q5): does full AI rescue play work and help?
// Measures recoveries, rescues, seat health, and war resolution per seed.
import { GameServer } from "../engine/server.js";

for (const SEED of [2026, 777, 31337, 4242, 9001]) {
  const server = new GameServer({ mapSeed: SEED, enableAi: true, aiDifficulty: 1 });
  const counts = {};
  for (let i = 0; i < 12000 && server.state.phase === 0; i++) {
    server.step();
    for (const e of server.state.events) counts[e.type] = (counts[e.type] ?? 0) + 1;
  }
  const s = server.state;
  const operable = [0, 1].map((t) =>
    s.assets.filter((a) => a.team === t && a.state !== 2 && a.state !== 3).length);
  console.log(`seed ${SEED}: tick ${s.tick} phase ${s.phase ? "OVER" : "run"} ` +
    `winner ${s.winner} scores ${JSON.stringify(s.teamScores)} operable ${JSON.stringify(operable)} ` +
    `tows ${counts.tow_started ?? 0} restored ${counts.asset_restored ?? 0} ` +
    `rescued ${counts.operator_rescued ?? 0} delivered ${counts.operator_delivered ?? 0} ` +
    `downs ${counts.operator_downed ?? 0}`);
}
