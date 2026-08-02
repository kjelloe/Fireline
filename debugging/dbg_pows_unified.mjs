// POWS reconciliation: ONE probe, BOTH checks. Steps the normal and
// mirrored worlds in lockstep, captures each tick's AI plans, and
// checks state-mirroring AND plan-mirroring — whichever breaks first,
// with both views of that tick dumped.
import { GameServer } from "../engine/server.js";

const SEED = Number(process.env.SEED ?? 777);
const W = 128;
function makeServer(mirror) {
  const server = new GameServer({
    mapSeed: SEED, enableAi: true, aiDifficulty: 1, aiMirrored: mirror,
    mapProfile: "frontier_corridor", uniqueCrewing: true,
    rules: { powPreplaced: 2 },
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
for (const srv of [n, m]) {
  const orig = srv.ai.plan.bind(srv.ai);
  srv.ai.plan = (st) => { const c = orig(st); srv.lastPlan = c; return c; };
}
const mx = (x) => W * 256 - x;
const mirrorCmd = (c) => {
  const out = { ...c };
  if ("targetCellX" in out) out.targetCellX = 127 - out.targetCellX;
  return out;
};
for (let t = 0; t < 9000; t++) {
  n.step(); m.step();
  const pa = JSON.stringify((n.lastPlan ?? []).map(mirrorCmd));
  const pb = JSON.stringify(m.lastPlan ?? []);
  if (pa !== pb) {
    console.log(`PLANS diverge at tick ${n.state.tick}`);
    console.log("normal(x-flip):", pa.slice(0, 400));
    console.log("mirror        :", pb.slice(0, 400));
    break;
  }
  let bad = null;
  for (let i = 0; i < n.state.assets.length && !bad; i++) {
    const a = n.state.assets[i], b = m.state.assets[i];
    if (i === 32) continue;
    if (b.heading !== ((128 - a.heading) & 255)) bad = `asset ${i} heading ${a.heading} vs ${b.heading}`;
    else if (b.moveProgress !== a.moveProgress) bad = `asset ${i} moveProgress`;
    else if (b.x !== mx(a.x) || b.y !== a.y) bad = `asset ${i} pos`;
    else if (b.targetX !== mx(a.targetX) && !(b.targetX === a.targetX && (a.targetX >> 8) === 64)) bad = `asset ${i} target (${a.targetX} vs ${b.targetX})`;
  }
  if (bad) {
    console.log(`STATE diverges at tick ${n.state.tick} (plans were mirror-equal): ${bad}`);
    for (const [name, s] of [["normal", n.state], ["mirror", m.state]]) {
      const a = s.assets[0];
      console.log(name, JSON.stringify({ x: a.x, y: a.y, tx: a.targetX, ty: a.targetY, h: a.heading, mp: a.moveProgress }));
      const near = s.assets.filter((o) => o.id !== 0 &&
        Math.abs(o.x - a.x) < 700 && Math.abs(o.y - a.y) < 700)
        .map((o) => ({ id: o.id, x: o.x, y: o.y, st: o.state, op: o.operatorId }));
      console.log(name, "near:", JSON.stringify(near));
    }
    break;
  }
}
console.log("done at", n.state.tick);
