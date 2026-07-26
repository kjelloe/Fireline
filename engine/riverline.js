// engine/riverline.js — second map profile (prompt 19: "prep second map").
// A north-south river of rough ground splits the field; three road
// bridges cross it. Relays sit in mirrored pairs NORTH and SOUTH of the
// road — wars spread vertically and the bridges become the story.
// FAIRNESS BY CONSTRUCTION: random terrain is generated on the west half
// and mirrored to the east (x' = 127-x), so both sides fight the same
// ground — the balance invariant the frontier map learned the hard way.

import { seedSfc32, sfc32Next } from "../shared/prng.js";

export const RIVERLINE = Object.freeze({
  id: "riverline",
  width: 128,
  height: 128,
  roadRows: [62, 63, 64, 65],
  riverCols: [60, 61, 62, 63, 64, 65, 66, 67], // mirror-symmetric band
  bridgeRows: [[20, 23], [62, 65], [104, 107]], // inclusive spans
  teamABase: Object.freeze({ x: 6, y: 54, width: 18, height: 20 }),
  teamBBase: Object.freeze({ x: 104, y: 54, width: 18, height: 20 }),
});

const T_OPEN = 0;
const T_ROAD = 1;
const T_FOREST = 2;
const T_ROUGH = 3;

function idx(x, y) { return y * RIVERLINE.width + x; }
function randBelow(state, max) {
  const step = sfc32Next(state);
  return { value: (step.value >>> 0) % max, state: step.nextState };
}

export function generateRiverline(rootSeed) {
  const p = RIVERLINE;
  const cells = new Uint8Array(p.width * p.height);
  let state = seedSfc32(rootSeed >>> 0);

  // Random rough + forest on the WEST half only (fixed PRNG budget), then
  // mirrored east. Cell x=63 pairs with 64 — nothing straddles unevenly.
  for (let i = 0; i < 700; i++) {
    const rx = randBelow(state, p.width / 2); state = rx.state;
    const ry = randBelow(state, p.height); state = ry.state;
    if (cells[idx(rx.value, ry.value)] === T_OPEN) {
      cells[idx(rx.value, ry.value)] = T_ROUGH;
    }
  }
  for (let i = 0; i < 70; i++) {
    let wx = randBelow(state, p.width / 2); state = wx.state;
    let wy = randBelow(state, p.height); state = wy.state;
    let x = wx.value;
    let y = wy.value;
    for (let stepI = 0; stepI < 24; stepI++) {
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

  // The river drowns whatever it crosses (both halves — symmetric band).
  for (const x of p.riverCols) {
    for (let y = 0; y < p.height; y++) cells[idx(x, y)] = T_ROUGH;
  }
  // Bases are clear operational ground.
  for (const b of [p.teamABase, p.teamBBase]) {
    for (let y = b.y; y < b.y + b.height; y++) {
      for (let x = b.x; x < b.x + b.width; x++) cells[idx(x, y)] = T_OPEN;
    }
  }
  // Infrastructure last: the cross-map road, and the three bridges.
  for (const y of p.roadRows) {
    for (let x = 0; x < p.width; x++) cells[idx(x, y)] = T_ROAD;
  }
  for (const [y0, y1] of p.bridgeRows) {
    for (let y = y0; y <= y1; y++) {
      for (const x of p.riverCols) cells[idx(x, y)] = T_ROAD;
    }
  }
  return { width: p.width, height: p.height, cells, seed: rootSeed >>> 0 };
}
