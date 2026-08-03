// THE MID-WAR LEDGER (prompt 172). On a81477c the POWS=2 war is even
// through t=4000, then A loses 17 hulls to B's 4 in t≈4250-5000. This
// probe compares the RUN window (4000-5250) against a CONTROL window
// (2500-3750, the even period): every event type counted per window
// (team-split where resolvable), plus for in-window disables the
// victim team/chassis/band and killer type. The event family that
// JUMPS between windows names the switch-on. POWS=2, 5 seeds.
import { GameServer } from "../engine/server.js";
import { getUnitStats } from "../engine/units.js";

const CONTROL = [2500, 3750];
const RUN = [4000, 5250];
const win = (t) => (t >= CONTROL[0] && t < CONTROL[1] ? 0 : t >= RUN[0] && t < RUN[1] ? 1 : -1);

const counts = {}; // type -> [control, run] or type/team -> ...
const disables = { 0: {}, 1: {} }; // window -> victim detail
function bump(key, w) {
  if (!counts[key]) counts[key] = [0, 0];
  counts[key][w]++;
}

for (const seed of [2026, 777, 31337, 4242, 9001]) {
  const server = new GameServer({
    mapSeed: seed, enableAi: true, uniqueCrewing: true,
    rules: { powPreplaced: 2 },
  });
  for (let t = 0; t < 5300; t++) {
    server.step();
    const s = server.state;
    const w = win(s.tick);
    if (w === -1) continue;
    for (const e of s.events) {
      let teamTag = "";
      const a = e.assetId !== undefined ? s.assets[e.assetId] : null;
      const op = e.operatorId !== undefined ? s.operators?.[e.operatorId] : null;
      if (a && (a.team === 0 || a.team === 1)) teamTag = a.team === 0 ? "/A" : "/B";
      else if (op && (op.team === 0 || op.team === 1)) teamTag = op.team === 0 ? "/A" : "/B";
      bump(e.type + teamTag, w);
      if (e.type === "asset_disabled" && a && w === 1) {
        const d = disables[1];
        const key = `${a.team === 0 ? "A" : "B"} ${getUnitStats(a.type)?.name} col${(a.x >> 8) < 43 ? "W" : (a.x >> 8) < 85 ? "C" : "E"} by:${e.byType >= 0 ? getUnitStats(e.byType)?.name : e.by}`;
        d[key] = (d[key] ?? 0) + 1;
      }
    }
  }
}

console.log("event type            control(2500-3750)  run(4000-5250)  delta");
const rows = Object.entries(counts)
  .map(([k, [c, r]]) => [k, c, r, r - c])
  .sort((a, b) => Math.abs(b[3]) - Math.abs(a[3]));
for (const [k, c, r, d] of rows) {
  if (Math.abs(d) < 3 && c + r < 10) continue; // noise floor
  console.log(`${k.padEnd(28)} ${String(c).padStart(6)} ${String(r).padStart(14)} ${String(d >= 0 ? "+" + d : d).padStart(8)}`);
}
console.log("\nrun-window disables (victim team chassis band, killer):");
for (const [k, n] of Object.entries(disables[1]).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${n}x ${k}`);
}
