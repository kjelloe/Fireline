// POWS anomaly: diff the AI's PLANNED COMMANDS between the normal and
// mirrored worlds, tick by tick — the first non-mirrored command names
// the asymmetric doctrine outright.
import { GameServer } from "../engine/server.js";

const SEED = Number(process.env.SEED ?? 777);
const W = 128;
function makeServer(mirror) {
  const server = new GameServer({
    mapSeed: SEED, enableAi: true, aiDifficulty: 1, aiMirrored: mirror,
    mapProfile: "frontier_corridor", rules: { powPreplaced: 2 },
  });
  if (mirror) {
    const s = server.state;
    const cells = s.map.cells;
    for (let y = 0; y < s.map.height; y++) {
      for (let x = 0; x < W / 2; x++) {
        const a = y * W + x, b = y * W + (W - 1 - x);
        const t = cells[a]; cells[a] = cells[b]; cells[b] = t;
      }
    }
    const mx = (worldX) => W * 256 - worldX;
    for (const a of s.assets) { a.x = mx(a.x); a.targetX = mx(a.targetX); a.heading = (128 - a.heading) & 255; }
    for (const st of s.standards) { st.x = mx(st.x); st.homeCellX = W - 1 - st.homeCellX; }
    for (const site of s.sites) site.cellX = W - 1 - site.cellX;
    for (const b of s.bases) b.x = W - b.x - b.width;
    for (const p of s.prisons ?? []) p.cellX = W - 1 - p.cellX;
  }
  return server;
}
const n = makeServer(false), m = makeServer(true);
const cap = (srv) => {
  const orig = srv.ai.plan.bind(srv.ai);
  srv.ai.plan = (st) => { const c = orig(st); srv.lastPlan = c; return c; };
};
cap(n); cap(m);
const mirrorCmd = (c) => {
  const out = { ...c };
  if ("targetCellX" in out) out.targetCellX = 127 - out.targetCellX;
  return out;
};
for (let t = 0; t < 100; t++) {
  n.step(); m.step();
  const a = (n.lastPlan ?? []).map(mirrorCmd);
  const b = m.lastPlan ?? [];
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) {
    console.log(`PLAN DIVERGED at tick ${n.state.tick}`);
    console.log("normal (x-mirrored):", sa.slice(0, 600));
    console.log("mirror world       :", sb.slice(0, 600));
    break;
  }
}
console.log("done");
