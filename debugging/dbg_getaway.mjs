// Q70 probe: do attacker scouts ever reach the vault?
import { GameServer } from "../engine/server.js";
const server = new GameServer({ mapSeed: 2026, enableAi: true, uniqueCrewing: true, rules: { mode: 2, modeAttacker: 0 } });
const cell = (w) => w >> 8;
let best = 999;
for (let t = 0; t < 9000; t++) {
  server.step();
  const s = server.state;
  const std = s.standards.find((x) => x.team === 1);
  if (!std) continue;
  for (const a of s.assets) {
    if (a.team !== 0 || a.type !== 1 || a.state === 2 || a.state === 3) continue;
    const d = Math.max(Math.abs(cell(a.x) - cell(std.x)), Math.abs(cell(a.y) - cell(std.y)));
    if (d < best) { best = d; if (d <= 1) console.log(`t=${s.tick} scout #${a.id} AT the vault`); }
  }
  for (const e of s.events) {
    if (e.type === "asset_disabled") {
      const a = s.assets[e.assetId];
      if (a.team === 0 && a.type === 1) {
        const d = Math.max(Math.abs(cell(a.x) - cell(std.x)), Math.abs(cell(a.y) - cell(std.y)));
        if (d <= 12) console.log(`t=${s.tick} scout #${a.id} DIES ${d} cells from the vault (by=${e.by})`);
      }
    }
  }
  if (s.tick % 2000 === 0) console.log(`t=${s.tick} best scout distance so far: ${best}`);
  if (s.phase === 1) break;
}
console.log("final best:", best);
