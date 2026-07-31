// Command-level divergence: compare the AI's issued commands between
// the normal and mirrored worlds, mirror-normalized. The step engine
// was exonerated by dbg_mirror_diverge (targets already differ).
import { GameServer } from "../engine/server.js";

const SEED = Number(process.env.SEED ?? 2026);
const MAP = process.env.MAP || "frontier_corridor";
const TICKS = Number(process.env.TICKS ?? 3);
const W = 128;

function makeServer(mirror) {
  const server = new GameServer({
    mapSeed: SEED, enableAi: true, aiDifficulty: 1, aiMirrored: mirror, mapProfile: MAP,
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

const N = makeServer(false), M = makeServer(true);
const mirrorCmd = (c) => {
  const out = { ...c };
  if (out.targetCellX !== undefined) out.targetCellX = W - 1 - out.targetCellX;
  return out;
};
for (let t = 0; t < TICKS; t++) {
  N.step(); M.step();
  const nc = N.commandLog.slice().filter((e) => (e.tick ?? -1) === N.state.tick - 1).map((e) => e.cmd ?? e);
  const mc = M.commandLog.slice().filter((e) => (e.tick ?? -1) === M.state.tick - 1).map((e) => e.cmd ?? e);

  for (let i = 0; i < Math.max(nc.length, mc.length); i++) {
    const a = nc[i], b = mc[i] ? mirrorCmd(mc[i]) : undefined;
    const same = JSON.stringify(a) === JSON.stringify(b);
    if (!same) {
      console.log(`t=${N.state.tick} cmd[${i}] DIFFERS`);
      console.log("  normal          :", JSON.stringify(a));
      console.log("  mirror(mirrored):", JSON.stringify(b));
      console.log("  mirror(raw)     :", JSON.stringify(mc[i]));
    }
  }
}
