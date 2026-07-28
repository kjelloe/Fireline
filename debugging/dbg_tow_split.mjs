// dbg_tow_split.mjs — per-team tow/restore split: is the doctrine's tow
// economy working for BOTH teams?
import { GameServer } from "../engine/server.js";
const seed = Number(process.env.SEED ?? 31337);
const server = new GameServer({ mapSeed: seed, enableAi: true });
const tows = [0, 0], restores = [0, 0];
for (let t = 0; t < 12000; t++) {
  server.step();
  const s = server.state;
  for (const e of s.events) {
    if (e.type === "tow_started") {
      const towTeam = s.assets[e.by]?.team;
      if (towTeam !== undefined) tows[towTeam]++;
    }
    if (e.type === "asset_restored") {
      const team = s.assets[e.assetId]?.team;
      if (team !== undefined) restores[team]++;
    }
  }
  if (s.phase !== 0) break;
}
const s = server.state;
console.log(`seed ${seed}: tick ${s.tick} winner ${s.winner} scores [${s.teamScores}]`);
console.log(`tows A ${tows[0]} B ${tows[1]} · restores A ${restores[0]} B ${restores[1]}`);
const opA = s.assets.filter(a => a.team === 0 && a.state !== 2 && a.state !== 3).length;
const opB = s.assets.filter(a => a.team === 1 && a.state !== 2 && a.state !== 3).length;
console.log(`operable A ${opA} B ${opB}`);
