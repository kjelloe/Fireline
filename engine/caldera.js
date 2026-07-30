// engine/caldera.js — map 5 (playtest-10 item 40, the owner's design;
// banked in specs/10 §4e). THE CIRCLE MAP: the main road leaves each
// base's SIDE GATES and runs in a ring both ways to the other base;
// the centre holds only a dirt trail (the fast, risky shortcut); two
// mirrored mountains sit inside the ring as obstacles. Built for two
// lives: symmetric standard wars now, the Convoy Escort mode's
// route-choice triangle (north ring / south ring / centre trail) later.
// FAIRNESS BY CONSTRUCTION: random terrain generates west, mirrors
// east (x' = 127-x) — the house pattern.

import { seedSfc32, sfc32Next } from "../shared/prng.js";
import { applyBaseWalls } from "./basewalls.js";

export const CALDERA = Object.freeze({
  id: "caldera",
  width: 128,
  height: 128,
  // The ring: rows 30/97 spanning the gate columns, columns 14/113
  // linking each base's two side gates to both ring roads.
  ringRows: [30, 97],
  ringCols: [14, 113],
  ringSpanX: [14, 113], // inclusive
  // The centre: DIRT ONLY (trail rows where other maps put the road).
  trailRows: [62, 63, 64, 65],
  teamABase: Object.freeze({ x: 6, y: 54, width: 18, height: 20 }),
  teamBBase: Object.freeze({ x: 104, y: 54, width: 18, height: 20 }),
  // Two mountains (mirror pair) in the northern bowl — they shadow the
  // diagonals between ring and centre without touching either artery.
  mesas: [
    Object.freeze({ x0: 40, y0: 38, x1: 50, y1: 50 }),
    Object.freeze({ x0: 77, y0: 38, x1: 87, y1: 50 }),
  ],
});

const T_OPEN = 0;
const T_ROAD = 1;
const T_FOREST = 2;
const T_ROUGH = 3;
const T_BLOCKING = 4;
const T_PATH = 5;

function idx(x, y) { return y * CALDERA.width + x; }
function randBelow(state, max) {
  const step = sfc32Next(state);
  return { value: (step.value >>> 0) % max, state: step.nextState };
}

export function generateCaldera(rootSeed) {
  const p = CALDERA;
  const cells = new Uint8Array(p.width * p.height);
  let state = seedSfc32(rootSeed >>> 0);

  // Open-bowl identity: modest scatter, light forest (fixed PRNG
  // budget, west half, mirrored east).
  for (let i = 0; i < 800; i++) {
    const rx = randBelow(state, p.width / 2); state = rx.state;
    const ry = randBelow(state, p.height); state = ry.state;
    if (cells[idx(rx.value, ry.value)] === T_OPEN) {
      cells[idx(rx.value, ry.value)] = T_ROUGH;
    }
  }
  for (let clump = 0; clump < 60; clump++) {
    const sx = randBelow(state, p.width / 2); state = sx.state;
    const sy = randBelow(state, p.height); state = sy.state;
    let x = sx.value;
    let y = sy.value;
    for (let step = 0; step < 14; step++) {
      cells[idx(Math.min(x, p.width / 2 - 1), y)] = T_FOREST;
      const d = randBelow(state, 4); state = d.state;
      x = Math.max(0, Math.min(p.width / 2 - 1, x + [1, -1, 0, 0][d.value]));
      y = Math.max(0, Math.min(p.height - 1, y + [0, 0, 1, -1][d.value]));
    }
  }
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width / 2; x++) {
      cells[idx(p.width - 1 - x, y)] = cells[idx(x, y)];
    }
  }

  // The mountains (walls; the 18B rule + item-39 pathfinding own them).
  for (const m of p.mesas) {
    for (let y = m.y0; y <= m.y1; y++) {
      for (let x = m.x0; x <= m.x1; x++) cells[idx(x, y)] = T_BLOCKING;
    }
  }

  // The centre dirt road — trail, deliberately NOT pavement.
  for (const y of p.trailRows) {
    for (let x = 18; x <= 109; x++) cells[idx(x, y)] = T_PATH;
  }

  // The RING ROAD (2 cells thick so it reads as the main artery).
  for (const y of p.ringRows) {
    for (let x = p.ringSpanX[0]; x <= p.ringSpanX[1]; x++) {
      cells[idx(x, y)] = T_ROAD;
      cells[idx(x, y + (y === 30 ? 1 : -1))] = T_ROAD;
    }
  }
  for (const x of p.ringCols) {
    for (let y = 30; y <= 97; y++) {
      cells[idx(x, y)] = T_ROAD;
      cells[idx(x + (x === 14 ? 1 : -1), y)] = T_ROAD;
    }
  }

  // Bases last: clear compounds, then walls with gates. The ring
  // columns cross each base's north/south edges — the roads-never-
  // walled rule makes the side gates REAL road gates, exactly the
  // owner's "main road leaves side gates".
  for (const b of [p.teamABase, p.teamBBase]) {
    for (let y = b.y; y < b.y + b.height; y++) {
      for (let x = b.x; x < b.x + b.width; x++) {
        if (cells[idx(x, y)] !== T_ROAD) cells[idx(x, y)] = T_OPEN;
      }
    }
  }
  applyBaseWalls(cells, p.width, p.teamABase, true);
  applyBaseWalls(cells, p.width, p.teamBBase, false);
  return { width: p.width, height: p.height, cells, seed: rootSeed >>> 0 };
}
