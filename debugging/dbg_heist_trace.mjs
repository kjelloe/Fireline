// Heist attacker trace (prompt 141): where does the raid die?
// Logs the attacker's carrier fleet every 500 ticks — position, distance
// to the vault standard, nearby armed escorts, team losses — plus every
// carrier disable with its position.
import { GameServer } from "../engine/server.js";
import { getUnitStats } from "../engine/units.js";

const seed = Number(process.env.SEED ?? 2026);
const attacker = Number(process.env.ATT ?? 0);
const server = new GameServer({
  mapSeed: seed, enableAi: true,
  rules: { mode: 2, modeAttacker: attacker },
});
const cell = (w) => w >> 8;
for (let t = 0; t < 20000; t++) {
  server.step();
  const s = server.state;
  for (const e of s.events) {
    if (e.type === "asset_disabled") {
      const a = s.assets[e.assetId];
      if (a.team === attacker) {
        const st = getUnitStats(a.type);
        console.log(`t=${s.tick} DISABLE ${st.name}#${a.id} at (${cell(a.x)},${cell(a.y)}) by=${e.by}`);
      }
    }
    if (e.type === "standard_taken") console.log(`t=${s.tick} GRAB!`);
  }
  if (s.tick % 500 === 0) {
    const std = s.standards.find((x) => x.team !== attacker);
    const sx = cell(std.x), sy = cell(std.y);
    const carriers = s.assets.filter((a) =>
      a.team === attacker && getUnitStats(a.type).canCarryStandard &&
      a.state !== 2 && a.state !== 3);
    const alive = s.assets.filter((a) => a.team === attacker && a.state !== 2 && a.state !== 3).length;
    const dAlive = s.assets.filter((a) => a.team !== attacker && a.team !== -1 && a.state !== 2 && a.state !== 3).length;
    const parts = carriers.map((c) => {
      let esc = 0;
      for (const a of s.assets) {
        if (a.team !== attacker || a.id === c.id || a.state === 2 || a.state === 3) continue;
        const st = getUnitStats(a.type);
        if (st.canTow || st.canCarryStandard) continue;
        if (Math.max(Math.abs(cell(a.x) - cell(c.x)), Math.abs(cell(a.y) - cell(c.y))) <= 3) esc++;
      }
      const d = Math.max(Math.abs(cell(c.x) - sx), Math.abs(cell(c.y) - sy));
      return `#${c.id}@(${cell(c.x)},${cell(c.y)}) d=${d} esc=${esc}`;
    });
    console.log(`t=${s.tick} vault=(${sx},${sy}) alive=${alive}v${dAlive} carriers: ${parts.join(" | ")}`);
  }
  if (s.winner !== -1 || s.phase === 1) { console.log(`END winner=${s.winner} reason=${s.winReason} t=${s.tick}`); break; }
}
