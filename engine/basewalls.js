// engine/basewalls.js — base WALLS with gates (playtest-10 item 38, the
// Fireball homage): every base gets a T_BLOCKING ring on its perimeter
// with a 4-cell FRONT GATE facing the enemy and 4-cell SIDE GATES
// centred on the north and south edges. Two construction rules:
//
// 1. ROADS ARE NEVER WALLED — any road crossing the perimeter becomes
//    a natural gate, so every existing traffic artery (central road,
//    approach columns) survives untouched.
// 2. Gates mirror by construction: the front edge is the enemy-facing
//    one, side gates are centred on the edge, so A's wall reflects
//    exactly onto B's.
//
// The wall rule (18B/18E) makes the ring REFUSE entry; item-39 grid
// pathfinding steers plain move orders through the gates. When
// destructible terrain lands, these walls are the first candidates
// (banked, prompt-93).

import { T_ROAD, T_BLOCKING } from "./mapgen.js";

export const GATE_WIDTH = 4;

export function applyBaseWalls(cells, mapWidth, base, facingEast) {
  const x0 = base.x;
  const y0 = base.y;
  const x1 = base.x + base.width - 1;
  const y1 = base.y + base.height - 1;
  const wall = (x, y) => {
    if (cells[y * mapWidth + x] !== T_ROAD) cells[y * mapWidth + x] = T_BLOCKING;
  };
  for (let x = x0; x <= x1; x++) { wall(x, y0); wall(x, y1); }
  for (let y = y0; y <= y1; y++) { wall(x0, y); wall(x1, y); }

  const open = (x, y) => {
    if (cells[y * mapWidth + x] === T_BLOCKING) cells[y * mapWidth + x] = 0; // T_OPEN
  };
  // Side gates: centred on the north and south edges.
  const gx = x0 + ((base.width - GATE_WIDTH) >> 1);
  for (let x = gx; x < gx + GATE_WIDTH; x++) { open(x, y0); open(x, y1); }
  // Front gate: centred on the enemy-facing edge.
  const gy = y0 + ((base.height - GATE_WIDTH) >> 1);
  const fx = facingEast ? x1 : x0;
  for (let y = gy; y < gy + GATE_WIDTH; y++) open(fx, y);
}
