// Formation slice verdict probe: with POWS=2, does the AI raid party
// actually complete raids now? (Pre-formation baseline: 0-1 raids in
// 5 wars, raiders dying solo — the three-layer diagnosis.)
import { GameServer } from "../engine/server.js";
import { OP_CAPTIVE } from "../engine/state.js";

const TICKS = Number(process.env.TICKS ?? 16000);
for (const seed of [2026, 777, 31337, 4242, 9001]) {
  const server = new GameServer({
    mapSeed: seed, enableAi: true, rules: { powPreplaced: 2 },
  });
  let raids = 0, frees = 0, resecured = 0, phase1Ticks = 0, diveTicks = 0;
  const raiderDeaths = new Set();
  for (let t = 0; t < TICKS; t++) {
    server.step();
    const s = server.state;
    for (const e of s.events) {
      if (e.type === "prison_raided") { raids++; frees += e.freed ?? 0; }
      if (e.type === "pow_resecured") resecured++;
    }
    for (const team of [0, 1]) {
      const d = server.ai?.raidDebug?.[team];
      if (d && d.tick >= s.tick - 1 && d.opId !== -1) {
        if (d.phase === 1) phase1Ticks++;
        if (d.dive) diveTicks++;
        const a = s.assets[d.assetId];
        if (a && a.hp <= 0) raiderDeaths.add(`${team}:${d.assetId}:${s.tick / 1000 | 0}k`);
      }
    }
    if (s.winner !== -1) break;
  }
  const s = server.state;
  const captive = s.operators.filter((o) => o.state === OP_CAPTIVE).length;
  const powsLeft = (s.prisons ?? []).reduce((n, p) => n + p.pows.length, 0);
  console.log(
    `seed ${String(seed).padStart(5)}: raids=${raids} freed=${frees} ` +
    `resec=${resecured} captiveEnd=${captive} powsEnd=${powsLeft} winner=${s.winner} tick=${s.tick} ` +
    `phase1Ticks=${phase1Ticks} diveTicks=${diveTicks} raiderDeaths=${raiderDeaths.size}`);
}
