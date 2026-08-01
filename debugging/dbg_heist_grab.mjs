// The post-grab autopsy: what kills the Asset carrier?
import { GameServer } from "../engine/server.js";
import { getUnitStats } from "../engine/units.js";
const server = new GameServer({ mapSeed: 2026, enableAi: true, rules: { mode: 2, modeAttacker: 0 } });
const cell = (w) => w >> 8;
let grabTick = -1, carrierId = -1;
for (let t = 0; t < 9000; t++) {
  server.step();
  const s = server.state;
  for (const e of s.events) {
    if (e.type === "standard_taken") {
      grabTick = s.tick;
      const std = s.standards.find((x) => x.status === 1);
      carrierId = std?.carrierAssetId ?? -1;
      console.log(`t=${s.tick} GRAB by #${carrierId}`);
    }
    if (e.type === "asset_disabled" && grabTick > 0 && s.tick - grabTick < 600) {
      const a = s.assets[e.assetId];
      console.log(`t=${s.tick} disable #${e.assetId} team=${a.team} ${getUnitStats(a.type).name} at (${cell(a.x)},${cell(a.y)}) by=${e.by} byType=${e.byType}`);
    }
    if (e.type === "standard_dropped") console.log(`t=${s.tick} DROPPED at grab+${s.tick - grabTick}`);
  }
  if (grabTick > 0 && s.tick - grabTick < 600 && s.tick % 100 === 0 && carrierId >= 0) {
    const c = s.assets[carrierId];
    const near = s.assets.filter((a) => a.team === 1 && !((a.state === 2) || (a.state === 3)) && a.operatorId !== -1 &&
      Math.max(Math.abs(cell(a.x) - cell(c.x)), Math.abs(cell(a.y) - cell(c.y))) <= 5).length;
    console.log(`t=${s.tick} carrier hp=${c.hp} pos=(${cell(c.x)},${cell(c.y)}) enemiesNear=${near}`);
  }
  if (s.phase === 1) break;
}
