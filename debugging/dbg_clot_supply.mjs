// Prompt 221: is the eternal clot an out-of-supply stalemate?
import { GameServer } from "../engine/server.js";
import { inSupply } from "../engine/supply.js";
import { getUnitStats } from "../engine/units.js";

const server = new GameServer({ mapSeed: 2026, enableAi: true, aiDifficulty: 2 });
for (let i = 0; i < 6000; i++) server.step();
const s = server.state;
for (const id of [4, 6, 31, 19]) {
  const a = s.assets[id];
  const st = getUnitStats(a.type);
  console.log(`asset ${id} team ${a.team} ${st.name} state ${a.state}`,
    `cell (${Math.round(a.x / 256)},${Math.round(a.y / 256)})`,
    `ammo ${a.ammo} fuel ${a.fuel} supply ${inSupply(s, a)}`,
    `target (${Math.round(a.targetX / 256)},${Math.round(a.targetY / 256)})`);
}
