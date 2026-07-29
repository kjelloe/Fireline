// debugging/dbg_mirror_diverge.mjs — the equivariance divergence probe.
// Run the SAME seed twice: normal, and world-mirrored (the sim_sweep
// MIRROR transform). Step both in lockstep and find the FIRST tick where
// the mirrored state stops being the exact mirror of the normal state —
// that tick names the asymmetric subsystem outright.
//   SEED=7 MAP=riverline node debugging/dbg_mirror_diverge.mjs

import { GameServer } from "../engine/server.js";

const SEED = Number(process.env.SEED ?? 7);
const MAP = process.env.MAP || "riverline";
const HORIZON = Number(process.env.TICKS ?? 18000);

function makeServer(mirror) {
  const server = new GameServer({
    mapSeed: SEED, enableAi: true, aiDifficulty: 1, aiMirrored: mirror, mapProfile: MAP,
  });
  if (mirror) {
    const s = server.state;
    const W = s.map.width;
    const cells = s.map.cells;
    for (let y = 0; y < s.map.height; y++) {
      for (let x = 0; x < W / 2; x++) {
        const a = y * W + x;
        const b = y * W + (W - 1 - x);
        const t = cells[a]; cells[a] = cells[b]; cells[b] = t;
      }
    }
    // MIRROR TRANSFORM (fixed 2026-07-30). It used to be
    //   (W - 1) * 256 - x
    // which is an ANCHOR-PRESERVING reflection about cell CENTRES: it is
    // correct only for exact cell centres, maps every other position one
    // cell too far west, and sends the map's east edge (32767) to -255 —
    // off the map. Every mirrored run therefore measured a world that was
    // NOT the mirror of the normal one, which is enough to manufacture a
    // "side lean" out of terrain the unit never actually stood on.
    // The world spans 0..W*256-1, so the reflection is (W*256-1) - x.
    // MIRROR TRANSFORM. The world spans 0..W*256-1, so the reflection is
    // (W*256-1) - x. This is the mathematically correct one: it is an
    // involution, never leaves the map, and maps cell c to cell W-1-c for
    // EVERY position. (The original, (W-1)*256 - x, put any mid-cell
    // position one cell too far west and sent the east edge to -255.)
    //
    // NOTE, and it matters for how mirror results are read: exact
    // equivariance is UNREACHABLE while entities sit on cell LEFT EDGES
    // (cellToWorld(c) = c*256). A left edge does not reflect onto a left
    // edge, so a mirrored world starts up to 255 units (~1 cell) out of
    // step with the normal one, and AI targets - which are always
    // cell-aligned - do not reflect onto each other either. Mirror
    // sweeps therefore carry a <=1-cell artifact, which is the residue
    // specs/08 §4 recorded. Removing it means cell-CENTRED positions
    // (c*256+128), which mirror onto each other exactly - an engine
    // change with a fixture repin, not a harness tweak.
    const mx = (worldX) => (W * 256 - 1) - worldX;
    for (const a of s.assets) {
      a.x = mx(a.x); a.targetX = mx(a.targetX);
      a.heading = (128 - a.heading) & 255;
    }
    for (const st of s.standards) {
      st.x = mx(st.x);
      st.homeCellX = W - 1 - st.homeCellX;
    }
    for (const site of s.sites) site.cellX = W - 1 - site.cellX;
    for (const b of s.bases) b.x = W - b.x - b.width;
  }
  return server;
}

const normal = makeServer(false);
const mirrored = makeServer(true);
const W = normal.state.map.width;
const mx = (x) => (W * 256 - 1) - x;
const mh = (h) => (128 - h) & 255;

function firstDivergence(n, m) {
  for (let i = 0; i < n.assets.length; i++) {
    const a = n.assets[i], b = m.assets[i];
    if (b.x !== mx(a.x)) return `asset ${i} x: normal ${a.x} mirror ${b.x} (expect ${mx(a.x)})`;
    if (b.y !== a.y) return `asset ${i} y: ${a.y} vs ${b.y}`;
    if (b.heading !== mh(a.heading)) return `asset ${i} heading: ${a.heading} vs ${b.heading} (expect ${mh(a.heading)})`;
    if (b.hp !== a.hp) return `asset ${i} hp: ${a.hp} vs ${b.hp}`;
    if (b.state !== a.state) return `asset ${i} state: ${a.state} vs ${b.state}`;
    if (b.fuel !== a.fuel) return `asset ${i} fuel: ${a.fuel} vs ${b.fuel}`;
    if (b.ammo !== a.ammo) return `asset ${i} ammo: ${a.ammo} vs ${b.ammo}`;
    if (b.reloadTimer !== a.reloadTimer) return `asset ${i} reload: ${a.reloadTimer} vs ${b.reloadTimer}`;
  }
  for (let i = 0; i < n.sites.length; i++) {
    const a = n.sites[i], b = m.sites[i];
    if (b.owner !== a.owner) return `site ${i} owner: ${a.owner} vs ${b.owner}`;
    if (b.captureProgress !== a.captureProgress) return `site ${i} progress: ${a.captureProgress} vs ${b.captureProgress}`;
  }
  if (n.teamScores[0] !== m.teamScores[0] || n.teamScores[1] !== m.teamScores[1]) {
    return `scores: [${n.teamScores}] vs [${m.teamScores}]`;
  }
  return null;
}

for (let t = 0; t < HORIZON; t++) {
  normal.step();
  mirrored.step();
  const d = firstDivergence(normal.state, mirrored.state);
  if (d) {
    console.log(`DIVERGED at tick ${normal.state.tick}: ${d}`);
    const id = Number((d.match(/asset (\d+)/) ?? [])[1] ?? -1);
    if (id >= 0) {
      const a = normal.state.assets[id], b = mirrored.state.assets[id];
      console.log("normal :", JSON.stringify({ x: a.x, y: a.y, h: a.heading, st: a.state, tx: a.targetX, ty: a.targetY, op: a.operatorId }));
      console.log("mirror :", JSON.stringify({ x: b.x, y: b.y, h: b.heading, st: b.state, tx: b.targetX, ty: b.targetY, op: b.operatorId }));
    }
    process.exit(0);
  }
  if (normal.state.phase !== 0) break;
}
console.log(`no divergence through tick ${normal.state.tick} — mirrored war is the exact reflection`);
