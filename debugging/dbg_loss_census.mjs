// The merged-hunt's direct question (prompt 162): WHERE and HOW do the
// two teams' losses differ? Per-team disables by killer kind, by map
// column band, and by victim chassis — POWS=2 (the loud config) and
// default, 5 seeds each.
import { GameServer } from "../engine/server.js";
import { getUnitStats } from "../engine/units.js";

for (const pows of [2, 0]) {
  const agg = {
    0: { total: 0, byKiller: {}, byBand: [0, 0, 0], byType: {} },
    1: { total: 0, byKiller: {}, byBand: [0, 0, 0], byType: {} },
  };
  for (const seed of [2026, 777, 31337, 4242, 9001]) {
    const server = new GameServer({
      mapSeed: seed, enableAi: true, uniqueCrewing: true,
      rules: pows ? { powPreplaced: pows } : {},
    });
    for (let t = 0; t < 12000; t++) {
      server.step();
      const s = server.state;
      for (const e of s.events) {
        if (e.type !== "asset_disabled") continue;
        const a = s.assets[e.assetId];
        if (a.team !== 0 && a.team !== 1) continue;
        const rec = agg[a.team];
        rec.total++;
        rec.byKiller[e.by] = (rec.byKiller[e.by] ?? 0) + 1;
        const col = a.x >> 8;
        rec.byBand[col < 43 ? 0 : col < 85 ? 1 : 2]++;
        const name = getUnitStats(a.type).name;
        rec.byType[name] = (rec.byType[name] ?? 0) + 1;
      }
      if (s.phase === 1) break;
    }
  }
  console.log(`=== POWS=${pows} (5 seeds) ===`);
  for (const team of [0, 1]) {
    const r = agg[team];
    console.log(`team ${team}: ${r.total} losses | bands W/C/E: ${r.byBand.join("/")} | killers: ${JSON.stringify(r.byKiller)} | types: ${JSON.stringify(r.byType)}`);
  }
}
