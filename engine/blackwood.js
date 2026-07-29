// engine/blackwood.js — map 3 (slice 18A, prompt 60; design of record in
// specs/10_map_roster.md §3). The DENSE woodland map: forest is the
// dominant terrain, the central corridor is the ONLY road, and a trail
// ring plus twin center alleys carry the light chassis. The contested
// heart (two deep-woods relay pairs) sits off the pavement — tanks must
// leave the road or stand off. Mines, scouts, satchels, and the
// Sentinel own this ground; a weather front here is a nightmare.
// FAIRNESS BY CONSTRUCTION: random terrain generates on the west half
// and mirrors east (x' = 127-x) — the riverline pattern.

import { seedSfc32, sfc32Next } from "../shared/prng.js";

export const BLACKWOOD = Object.freeze({
  id: "blackwood",
  width: 128,
  height: 128,
  roadRows: [62, 63, 64, 65],
  leftApproachX: [14, 15, 16, 17],
  rightApproachX: [110, 111, 112, 113],
  teamABase: Object.freeze({ x: 6, y: 54, width: 18, height: 20 }),
  teamBBase: Object.freeze({ x: 104, y: 54, width: 18, height: 20 }),
  ringCols: [36, 91],   // mirror pair
  ringRows: [28, 99],   // spanning x 36..91 (mirror-closed)
  alleyCols: [58, 69],  // mirror pair, y 45..82
  // 18G logging roads (designer ruling 2026-07-30, terrain-only recovery
  // corridors): lateral trails through the combat heart, so a loaded tow
  // can exit the deep woods SIDEWAYS and come home around the central
  // crossfire instead of through it. Rows span a symmetric x-range, so
  // each is its own x-mirror.
  spurRows: [45, 82],   // spanning x 36..91 (mirror-closed)
  // Relay clearings: ring corners + the deep-woods pairs.
  clearings: [
    [36, 28], [91, 28], [36, 99], [91, 99],
    [58, 45], [69, 45], [58, 82], [69, 82],
  ],
});

const T_OPEN = 0;
const T_ROAD = 1;
const T_FOREST = 2;
const T_ROUGH = 3;
const T_PATH = 5;

function idx(x, y) { return y * BLACKWOOD.width + x; }
function randBelow(state, max) {
  const step = sfc32Next(state);
  return { value: (step.value >>> 0) % max, state: step.nextState };
}

export function generateBlackwood(rootSeed) {
  const p = BLACKWOOD;
  const cells = new Uint8Array(p.width * p.height);
  let state = seedSfc32(rootSeed >>> 0);

  // Rough scatter, then a HEAVY forest walk budget — the whole point of
  // the map. West half only (fixed PRNG budget), mirrored east.
  for (let i = 0; i < 500; i++) {
    const rx = randBelow(state, p.width / 2); state = rx.state;
    const ry = randBelow(state, p.height); state = ry.state;
    if (cells[idx(rx.value, ry.value)] === T_OPEN) {
      cells[idx(rx.value, ry.value)] = T_ROUGH;
    }
  }
  for (let clump = 0; clump < 260; clump++) {
    const sx = randBelow(state, p.width / 2); state = sx.state;
    const sy = randBelow(state, p.height); state = sy.state;
    let x = sx.value;
    let y = sy.value;
    for (let step = 0; step < 36; step++) {
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

  // Relay clearings: 9x9 open squares (Chebyshev radius 4 — squares
  // mirror onto their partner squares exactly).
  for (const [cx, cy] of p.clearings) {
    for (let y = cy - 4; y <= cy + 4; y++) {
      for (let x = cx - 4; x <= cx + 4; x++) cells[idx(x, y)] = T_OPEN;
    }
  }

  // Trails: the ring (columns 36/91 y 28..99, rows 28/99 x 36..91) and
  // the twin center alleys (columns 58/69, y 45..82). All mirror-closed.
  for (const x of p.ringCols) {
    for (let y = 28; y <= 99; y++) cells[idx(x, y)] = T_PATH;
  }
  for (const y of p.ringRows) {
    for (let x = 36; x <= 91; x++) cells[idx(x, y)] = T_PATH;
  }
  for (const x of p.alleyCols) {
    for (let y = 45; y <= 82; y++) cells[idx(x, y)] = T_PATH;
  }
  for (const y of p.spurRows) { // 18G logging roads
    for (let x = 36; x <= 91; x++) cells[idx(x, y)] = T_PATH;
  }

  // Infrastructure last: the ONE road, base approaches, clear bases.
  for (const y of p.roadRows) {
    for (let x = 0; x < p.width; x++) cells[idx(x, y)] = T_ROAD;
  }
  for (const x of p.leftApproachX) {
    for (let y = p.teamABase.y; y < p.teamABase.y + p.teamABase.height; y++) {
      cells[idx(x, y)] = T_ROAD;
    }
  }
  for (const x of p.rightApproachX) {
    for (let y = p.teamBBase.y; y < p.teamBBase.y + p.teamBBase.height; y++) {
      cells[idx(x, y)] = T_ROAD;
    }
  }
  for (const b of [p.teamABase, p.teamBBase]) {
    for (let y = b.y; y < b.y + b.height; y++) {
      for (let x = b.x; x < b.x + b.width; x++) {
        if (cells[idx(x, y)] !== T_ROAD) cells[idx(x, y)] = T_OPEN;
      }
    }
  }
  return { width: p.width, height: p.height, cells, seed: rootSeed >>> 0 };
}
