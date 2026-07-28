// Why don't raids launch? Track the raider carrier's state, escort
// distances, and window occasions across a war.
import { GameServer } from "../engine/server.js";
import { getUnitStats } from "../engine/units.js";
const server = new GameServer({ mapSeed: 9001, enableAi: true });
const C = 256;
for (let t = 0; t < 12000; t++) {
  server.step();
  const s = server.state;
  if (t % 600 === 0) {
    const std = s.standards[1];
    for (const team of [0]) {
      const carrier = s.assets.find((a) => a.team === team && getUnitStats(a.type).canCarryStandard && a.state !== 2 && a.state !== 3 && a.operatorId !== -1);
      if (!carrier) { console.log(t, "no crewed carrier"); continue; }
      const cx = carrier.x / C | 0, cy = carrier.y / C | 0;
      let near = 0;
      for (const a of s.assets) {
        if (a.team !== team || a.id === carrier.id || a.state === 2 || a.state === 3 || a.operatorId === -1) continue;
        const st = getUnitStats(a.type);
        if (st.canTow || st.canCarryStandard) continue;
        const d = Math.max(Math.abs((a.x / C | 0) - cx), Math.abs((a.y / C | 0) - cy));
        if (d <= 6) near++;
      }
      console.log(`t=${t} carrier${carrier.id} cell=(${cx},${cy}) state=${carrier.state} aboard=${carrier.aboard1},${carrier.aboard2} escortsNear=${near} stdStatus=${std.status}`);
    }
  }
  if (s.phase !== 0) break;
}
