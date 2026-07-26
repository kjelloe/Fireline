// engine/frontier_corridor.js
// Milestone 0I: deterministic 128x128 named map profile.
// Pure and renderer-independent. Terrain IDs match engine/mapgen.js / data/rules.json.

import { seedSfc32, sfc32Next } from "../shared/prng.js";

export const FRONTIER_CORRIDOR = Object.freeze({
  id: "frontier_corridor",
  width: 128,
  height: 128,
  roadRows: [62, 63, 64, 65],
  leftApproachX: [14, 15, 16, 17],
  rightApproachX: [110, 111, 112, 113],
  teamABase: Object.freeze({ x: 6, y: 54, width: 18, height: 20 }),
  teamBBase: Object.freeze({ x: 104, y: 54, width: 18, height: 20 }),
  objective: Object.freeze({ x: 56, y: 56, width: 16, height: 16 }),
});

const T_OPEN = 0;
const T_ROAD = 1;
const T_FOREST = 2;
const T_ROUGH = 3;
const T_PATH = 5; // 11N

function indexOf(x, y, width) { return y * width + x; }
function randBelow(state, max) {
  const step = sfc32Next(state);
  return { value: (step.value >>> 0) % max, state: step.nextState };
}
function fillRect(cells, x, y, width, height, value) {
  for (let yy = y; yy < y + height; yy++) {
    for (let xx = x; xx < x + width; xx++) cells[indexOf(xx, yy, FRONTIER_CORRIDOR.width)] = value;
  }
}

// Road connectivity is stamped last, after all stochastic terrain.
function stampInfrastructure(cells) {
  const p = FRONTIER_CORRIDOR;
  for (const y of p.roadRows) fillRect(cells, 0, y, p.width, 1, T_ROAD);
  for (const x of p.leftApproachX) fillRect(cells, x, p.teamABase.y, 1, p.teamABase.height, T_ROAD);
  for (const x of p.rightApproachX) fillRect(cells, x, p.teamBBase.y, 1, p.teamBBase.height, T_ROAD);
  fillRect(cells, p.teamABase.x, p.teamABase.y, p.teamABase.width, p.teamABase.height, T_OPEN);
  fillRect(cells, p.teamBBase.x, p.teamBBase.y, p.teamBBase.width, p.teamBBase.height, T_OPEN);
  fillRect(cells, p.objective.x, p.objective.y, p.objective.width, p.objective.height, T_OPEN);
  // 11N: mirrored woodland paths — slower flanking routes north and south
  // of the corridor (rows 40/41 and 86/87, x 24..103 = mirror-closed).
  for (const y of [40, 41, 86, 87]) fillRect(cells, 24, y, 80, 1, T_PATH);
  // Restore the guaranteed cross-map route after clearing operational zones.
  for (const y of p.roadRows) fillRect(cells, 0, y, p.width, 1, T_ROAD);
  for (const x of p.leftApproachX) fillRect(cells, x, p.teamABase.y, 1, p.teamABase.height, T_ROAD);
  for (const x of p.rightApproachX) fillRect(cells, x, p.teamBBase.y, 1, p.teamBBase.height, T_ROAD);
}

export function generateFrontierCorridor(rootSeed) {
  const p = FRONTIER_CORRIDOR;
  const cells = new Uint8Array(p.width * p.height);
  let state = seedSfc32(rootSeed >>> 0);

  // Fixed PRNG budget: 1,100 rough attempts then 110 forest random-walk clumps.
  for (let i = 0; i < 1100; i++) {
    const rx = randBelow(state, p.width); state = rx.state;
    const ry = randBelow(state, p.height); state = ry.state;
    const at = indexOf(rx.value, ry.value, p.width);
    if (cells[at] === T_OPEN) cells[at] = T_ROUGH;
  }
  for (let clump = 0; clump < 110; clump++) {
    const sx = randBelow(state, p.width); state = sx.state;
    const sy = randBelow(state, p.height); state = sy.state;
    let x = sx.value, y = sy.value;
    cells[indexOf(x, y, p.width)] = T_FOREST;
    for (let step = 0; step < 12; step++) {
      const dx = randBelow(state, 3); state = dx.state;
      const dy = randBelow(state, 3); state = dy.state;
      x = Math.max(0, Math.min(p.width - 1, x + dx.value - 1));
      y = Math.max(0, Math.min(p.height - 1, y + dy.value - 1));
      const at = indexOf(x, y, p.width);
      if (cells[at] === T_OPEN) cells[at] = T_FOREST;
    }
  }
  stampInfrastructure(cells);
  return { id: p.id, seed: rootSeed >>> 0, width: p.width, height: p.height, cells };
}

export function countTerrain(cells) {
  const counts = [0, 0, 0, 0, 0, 0]; // 11N: index 5 = path
  for (const cell of cells) counts[cell]++;
  return counts;
}
