// engine/sawtooth.js — map 4 (slice 18B, prompt 60; design of record in
// specs/10_map_roster.md §4). The ARMOR map, and the first to use
// T_BLOCKING at scale: two impassable mesa bands split the field into
// three open lanes, each band pierced by two narrow gaps (T_PATH — the
// saw teeth). Chokes with honest bypasses: the other lane, or the long
// exposed edge corridors around the mesa ends. Open lanes give tank
// duels and artillery arcs; the gaps belong to mines, Sentinels, and
// mortars. FAIRNESS BY CONSTRUCTION: random terrain generates west and
// mirrors east (x' = 127-x).

import { seedSfc32, sfc32Next } from "../shared/prng.js";

export const SAWTOOTH = Object.freeze({
  id: "sawtooth",
  width: 128,
  height: 128,
  roadRows: [62, 63, 64, 65],
  leftApproachX: [14, 15, 16, 17],
  rightApproachX: [110, 111, 112, 113],
  teamABase: Object.freeze({ x: 6, y: 54, width: 18, height: 20 }),
  teamBBase: Object.freeze({ x: 104, y: 54, width: 18, height: 20 }),
  mesaBands: [[40, 52], [76, 88]],  // inclusive row spans
  mesaCols: [20, 107],              // inclusive x span (mirror-closed)
  gapCols: [[40, 44], [83, 87]],    // inclusive x spans, mirror pair
});

const T_OPEN = 0;
const T_ROAD = 1;
const T_FOREST = 2;
const T_ROUGH = 3;
const T_BLOCKING = 4;
const T_PATH = 5;

function idx(x, y) { return y * SAWTOOTH.width + x; }
function randBelow(state, max) {
  const step = sfc32Next(state);
  return { value: (step.value >>> 0) % max, state: step.nextState };
}

export function generateSawtooth(rootSeed) {
  const p = SAWTOOTH;
  const cells = new Uint8Array(p.width * p.height);
  let state = seedSfc32(rootSeed >>> 0);

  // Open-lane identity: modest rough scatter, sparse forest clumps for
  // ambush texture. West half only (fixed PRNG budget), mirrored east.
  for (let i = 0; i < 900; i++) {
    const rx = randBelow(state, p.width / 2); state = rx.state;
    const ry = randBelow(state, p.height); state = ry.state;
    if (cells[idx(rx.value, ry.value)] === T_OPEN) {
      cells[idx(rx.value, ry.value)] = T_ROUGH;
    }
  }
  for (let clump = 0; clump < 40; clump++) {
    const sx = randBelow(state, p.width / 2); state = sx.state;
    const sy = randBelow(state, p.height); state = sy.state;
    let x = sx.value;
    let y = sy.value;
    for (let step = 0; step < 12; step++) {
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

  // The mesas: impassable bands with T_PATH gaps (the saw teeth). Edge
  // corridors (x < 20 and x > 107) stay open around the mesa ends.
  for (const [y0, y1] of p.mesaBands) {
    for (let y = y0; y <= y1; y++) {
      for (let x = p.mesaCols[0]; x <= p.mesaCols[1]; x++) {
        const inGap = p.gapCols.some(([g0, g1]) => x >= g0 && x <= g1);
        cells[idx(x, y)] = inGap ? T_PATH : T_BLOCKING;
      }
    }
  }

  // Infrastructure last: the canyon road, base approaches, clear bases.
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
