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

const MODE = process.env.MODE === "convoy" ? 1 : process.env.MODE === "heist" ? 2 : null;
const MODEATTACKER = process.env.MODEATTACKER === "1" ? 1 : 0;

function makeServer(mirror) {
  const server = new GameServer({
    mapSeed: SEED, enableAi: true, aiDifficulty: 1, aiMirrored: mirror, mapProfile: MAP,
    uniqueCrewing: true,
    ...(MODE !== null ? { rules: { mode: MODE, modeAttacker: MODEATTACKER } } : {}),
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
    // MIRROR TRANSFORM: reflect about the map's true centre line
    // (x = W*256/2), i.e. x' = W*256 - x. Entities sit at cell CENTRES
    // (cellToWorld(c) = c*256+128), and this maps the centre of cell c
    // onto the centre of cell W-1-c EXACTLY, for every cell — which is
    // what makes a mirrored world a true mirror.
    //
    // History: (W-1)*256 - x was anchor-preserving about cell centres
    // and sent the east edge off the map; (W*256-1) - x was the right
    // reflection for the OLD left-edge convention but landed one unit
    // short of a centre. Both are wrong now. See specs/08 §4.
    const mx = (worldX) => W * 256 - worldX;
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
    for (const p of s.prisons ?? []) p.cellX = W - 1 - p.cellX; // same gap sim_sweep had
    if (s.mission) s.mission.gateCellX = W - 1 - s.mission.gateCellX;
  }
  return server;
}

const normal = makeServer(false);
const mirrored = makeServer(true);
const W = normal.state.map.width;
const mx = (x) => W * 256 - x;
const mh = (h) => (128 - h) & 255;

function firstDivergence(n, m) {
  for (let i = 0; i < n.assets.length; i++) {
    const a = n.assets[i], b = m.assets[i];
    // Asset 32 (the landship) is CENTRE-ANCHORED by rule: its berth
    // column (64) has no mirror partner, so a respawn puts it at the
    // same rule-position in both worlds. Rule-equal OR mirrored both
    // count as agreement for the neutral hull.
    if (i === 32 && (b.x === mx(a.x) || b.x === a.x)) {
      if (b.y !== a.y) return `asset ${i} y: ${a.y} vs ${b.y}`;
      continue;
    }
    if (b.x !== mx(a.x)) return `asset ${i} x: normal ${a.x} mirror ${b.x} (expect ${mx(a.x)})`;
    if (b.y !== a.y) return `asset ${i} y: ${a.y} vs ${b.y}`;
    if (b.heading !== mh(a.heading)) return `asset ${i} heading: ${a.heading} vs ${b.heading} (expect ${mh(a.heading)})`;
    if (b.hp !== a.hp) return `asset ${i} hp: ${a.hp} vs ${b.hp}`;
    if (b.state !== a.state) return `asset ${i} state: ${a.state} vs ${b.state}`;
    // Centre-anchored designs (the B6 drop column, the landship berth)
    // produce RULE-EQUAL targets at cell 64 in both worlds — the
    // centre column is its own mirror by design.
    const centreTarget = b.targetX === a.targetX && (a.targetX >> 8) === 64;
    if (!centreTarget && b.targetX !== mx(a.targetX)) return `asset ${i} targetX: ${a.targetX} vs ${b.targetX} (expect ${mx(a.targetX)})`;
    if (b.targetY !== a.targetY) return `asset ${i} targetY: ${a.targetY} vs ${b.targetY}`;
    if (b.fuel !== a.fuel) return `asset ${i} fuel: ${a.fuel} vs ${b.fuel}`;
    if (b.ammo !== a.ammo) return `asset ${i} ammo: ${a.ammo} vs ${b.ammo}`;
    if (b.reloadTimer !== a.reloadTimer) return `asset ${i} reload: ${a.reloadTimer} vs ${b.reloadTimer}`;
  }
  const mc = (x) => W - 1 - x;
  for (let i = 0; i < (n.caltrops ?? []).length || i < (m.caltrops ?? []).length; i++) {
    const a = (n.caltrops ?? [])[i], b = (m.caltrops ?? [])[i];
    if (!a || !b) return `caltrop count: ${n.caltrops?.length} vs ${m.caltrops?.length}`;
    if (b.cellX !== mc(a.cellX) || b.cellY !== a.cellY || b.team !== a.team || b.ticksLeft !== a.ticksLeft) {
      return `caltrop ${i}: n(${a.cellX},${a.cellY},t${a.team},${a.ticksLeft}) vs m(${b.cellX},${b.cellY},t${b.team},${b.ticksLeft}) expect x=${mc(a.cellX)}`;
    }
  }
  for (let i = 0; i < n.mines.length || i < m.mines.length; i++) {
    const a = n.mines[i], b = m.mines[i];
    if (!a || !b) return `mine count: ${n.mines.length} vs ${m.mines.length}`;
    if (b.cellX !== mc(a.cellX) || b.cellY !== a.cellY || b.armTimer !== a.armTimer || b.marked !== a.marked) {
      return `mine ${i}: (${a.cellX},${a.cellY}) vs (${b.cellX},${b.cellY}) expect x=${mc(a.cellX)}`;
    }
  }
  for (let i = 0; i < n.downed.length || i < m.downed.length; i++) {
    const a = n.downed[i], b = m.downed[i];
    if (!a || !b) return `downed count: ${n.downed.length} vs ${m.downed.length}`;
    if (b.x !== mx(a.x) || b.y !== a.y) return `downed ${i} pos: (${a.x},${a.y}) vs (${b.x},${b.y})`;
  }
  if ((n.tickets?.[0] ?? 0) !== (m.tickets?.[0] ?? 0) || (n.tickets?.[1] ?? 0) !== (m.tickets?.[1] ?? 0)) {
    return `tickets: [${n.tickets}] vs [${m.tickets}]`;
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

let prevSnap = null;
for (let t = 0; t < HORIZON; t++) {
  if (process.env.DUMP) {
    prevSnap = [normal.state, mirrored.state].map((s) => JSON.parse(JSON.stringify(
      s.assets.map((a) => ({ id: a.id, x: a.x, y: a.y, h: a.heading, st: a.state,
        tx: a.targetX, ty: a.targetY, sup: a.suppressedTimer, wp: a.waypoints?.length ?? 0 })))));
  }
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
      if (prevSnap) {
        console.log("PRE-TICK (t-1), diverging asset + all within 4 cells:");
        const pa = prevSnap[0][id], pb = prevSnap[1][id];
        console.log("  n[self]:", JSON.stringify(pa));
        console.log("  m[self]:", JSON.stringify(pb));
        for (const s of prevSnap[0]) {
          if (s.id !== id && Math.abs(s.x - pa.x) <= 1024 && Math.abs(s.y - pa.y) <= 1024) {
            console.log("  n[near]:", JSON.stringify(s));
            const ms = prevSnap[1][s.id];
            console.log("  m[near]:", JSON.stringify(ms), "mx(exp):", mx(s.x));
          }
        }
      }
    }
    process.exit(0);
  }
  if (normal.state.phase !== 0) break;
}
console.log(`no divergence through tick ${normal.state.tick} — mirrored war is the exact reflection`);
