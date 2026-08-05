// Q83 follow-up: do raids ever SPRING a POW, and what becomes of them?
import { GameServer } from "../engine/server.js";
for (const seed of [2026, 777]) {
  const server = new GameServer({
    mapSeed: seed, enableAi: true, uniqueCrewing: true, rules: { powPreplaced: 2 },
  });
  let sprungSeen = 0, maxFreedAlive = 0, resecured = 0;
  const kinds = {};
  for (let t = 0; t < 12000; t++) {
    server.step();
    const s = server.state;
    for (const e of s.events) {
      if (/pow|prison|captiv/i.test(e.type)) kinds[e.type] = (kinds[e.type] ?? 0) + 1;
      if (e.type === "pow_resecured") resecured++;
    }
    const freed = (s.downed ?? []).filter((d) => d.freedPow === 1);
    if (freed.length > maxFreedAlive) maxFreedAlive = freed.length;
    sprungSeen = Math.max(sprungSeen, freed.length);
    if (s.phase === 1) break;
  }
  console.log(`seed ${seed}: max freed-alive at once ${maxFreedAlive}, re-secured ${resecured}`);
  console.log("  pow/prison events:", JSON.stringify(kinds));
}
