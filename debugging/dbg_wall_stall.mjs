// debugging/dbg_wall_stall.mjs — 18B/18C follow-up: the wall rule makes
// units REFUSE a step into impassable ground. Correct, but it can hide a
// quality bug: a unit whose target sits across a mesa will press its face
// against the rock forever, "moving" every tick and going nowhere.
// The blocking-cell invariant test cannot see that (it only asserts
// nobody is INSIDE a mesa). This measures the stall directly.
//
//   MAP=sawtooth node debugging/dbg_wall_stall.mjs

import { GameServer } from "../engine/server.js";

const MAP = process.env.MAP || "sawtooth";
const SEEDS = (process.env.SEEDS || "1,2,3").split(",").map(Number);
const TICKS = Number(process.env.TICKS || 6000);
const STALL_TICKS = 300; // 30 s of "moving" without covering a cell

for (const seed of SEEDS) {
  const war = new GameServer({ mapSeed: seed, enableAi: true, aiDifficulty: 1, mapProfile: MAP });
  const last = new Map();      // assetId -> {x, y, since}
  const stalled = new Map();   // assetId -> worst stall length
  let stallTickTotal = 0;

  for (let i = 0; i < TICKS && war.state.phase === 0; i++) {
    war.step();
    const st = war.state;
    for (const a of st.assets) {
      if (a.state !== 1 /* MOVING */) { last.delete(a.id); continue; }
      const cell = `${(a.x / 256) | 0},${(a.y / 256) | 0}`;
      const prev = last.get(a.id);
      if (!prev || prev.cell !== cell) {
        last.set(a.id, { cell, since: st.tick });
      } else {
        const held = st.tick - prev.since;
        if (held >= STALL_TICKS) {
          stallTickTotal += 1;
          if (held > (stalled.get(a.id) ?? 0)) stalled.set(a.id, held);
        }
      }
    }
  }
  // Is the stall NEXT TO a wall (our suspicion) or just idle traffic?
  const st = war.state;
  const nearWall = [];
  for (const [id, held] of stalled) {
    const a = st.assets[id];
    const cx = (a.x / 256) | 0;
    const cy = (a.y / 256) | 0;
    let touching = false;
    for (let dy = -1; dy <= 1 && !touching; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= st.map.width || y >= st.map.height) continue;
        if (st.map.cells[y * st.map.width + x] === 4 /* T_BLOCKING */) { touching = true; break; }
      }
    }
    if (touching) nearWall.push(`${id}:${held}t`);
  }
  console.log(`seed ${seed}: ticks ${st.tick} | assets that stalled >=${STALL_TICKS}t while MOVING: ` +
    `${stalled.size}/${st.assets.length} | of those, touching a mesa at the end: ` +
    `${nearWall.length}${nearWall.length ? ` [${nearWall.join(" ")}]` : ""}`);
}
