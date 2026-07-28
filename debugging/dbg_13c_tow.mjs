// dbg_13c_tow.mjs — why did tows die under routing? Trace truck 11's
// orders, nearest-wreck distance, and any tow attempts, one war.
import { GameServer } from "../engine/server.js";
const server = new GameServer({ mapSeed: Number(process.env.SEED ?? 2026), enableAi: true });
const C = 256;
let lastLog = -1;
for (let t = 0; t < 6000; t++) {
  server.step();
  const s = server.state;
  for (const e of s.events) {
    if (e.type === "tow_started" || e.type === "rejected" && /tow/.test(e.reason ?? "")) {
      console.log(t, JSON.stringify(e));
    }
  }
  if (t % 400 === 0) {
    const trucks = s.assets.filter((a) => [3].includes(a.type) && a.team === 0 && a.state !== 2 && a.state !== 3);
    const wrecks = s.assets.filter((a) => (a.state === 2) && a.towedBy === -1);
    for (const tr of trucks.slice(0, 2)) {
      let best = 1e9, bw = null;
      for (const w of wrecks) {
        if (w.team !== tr.team) continue;
        const d = Math.max(Math.abs((w.x - tr.x) / C | 0), Math.abs((w.y - tr.y) / C | 0));
        if (d < best) { best = d; bw = w; }
      }
      console.log(`t=${t} truck${tr.id} op=${tr.operatorId} cell=(${tr.x / C | 0},${tr.y / C | 0}) state=${tr.state} nearestWreck=${bw ? bw.id : "-"} d=${best === 1e9 ? "-" : best} wrecks=${wrecks.length}`);
    }
  }
  if (s.phase !== 0) { console.log("over at", t); break; }
}
