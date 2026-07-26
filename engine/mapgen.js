// engine/mapgen.js — deterministic parametric map generator (milestone 0F contract).
// Reconstructed: the original 0F implementation was lost; this version honors the
// structural contract (road spine at midY, open protected base zones, valid dims
// 4..256, reproducibility) and fixture 0F was regenerated against it (fixtureVersion 2).
// The primary gameplay map remains engine/frontier_corridor.js, whose pinned
// fixtures predate the loss and still verify byte-for-byte.

import { seedSfc32, sfc32Next } from "../shared/prng.js";

export const T_OPEN = 0;
export const T_ROAD = 1;
export const T_FOREST = 2;
export const T_ROUGH = 3;
export const T_BLOCKING = 4;
export const T_PATH = 5; // 11N: dirt road / woodland trail
export const T_WATER = 6; // 12C: rivers — grim to ford, home to Skimmers

export function generateMap(seed, width, height) {
  if (!Number.isInteger(width) || width < 4 || width > 256) {
    throw new RangeError(`width out of range: ${width}`);
  }
  if (!Number.isInteger(height) || height < 4 || height > 256) {
    throw new RangeError(`height out of range: ${height}`);
  }

  const cells = new Uint8Array(width * height);
  const protectedCells = new Uint8Array(width * height);
  const midY = (height / 2) | 0;

  // Infrastructure first: road spine plus both 2x2 base zones, all protected
  // from stochastic terrain so gameplay guarantees survive any seed.
  for (let x = 0; x < width; x++) {
    cells[midY * width + x] = T_ROAD;
    protectedCells[midY * width + x] = 1;
  }
  const bases = [
    { x: 1, y: 1 },
    { x: width - 3, y: height - 3 },
  ];
  for (const base of bases) {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const at = (base.y + dy) * width + (base.x + dx);
        cells[at] = T_OPEN;
        protectedCells[at] = 1;
      }
    }
  }

  let prng = seedSfc32(seed >>> 0);
  const randBelow = (max) => {
    const r = sfc32Next(prng);
    prng = r.nextState;
    return (r.value >>> 0) % max;
  };
  const scatter = (x, y, terrain) => {
    const at = y * width + x;
    if (!protectedCells[at] && cells[at] === T_OPEN) cells[at] = terrain;
  };

  // Fixed PRNG budget scaled by area: rough scatter then forest random walks.
  const roughAttempts = ((width * height) / 10) | 0;
  for (let i = 0; i < roughAttempts; i++) {
    scatter(randBelow(width), randBelow(height), T_ROUGH);
  }
  const forestClumps = Math.max(1, ((width * height) / 32) | 0);
  for (let clump = 0; clump < forestClumps; clump++) {
    let x = randBelow(width);
    let y = randBelow(height);
    scatter(x, y, T_FOREST);
    for (let step = 0; step < 12; step++) {
      const dir = randBelow(9);
      x = Math.max(0, Math.min(width - 1, x + (dir % 3) - 1));
      y = Math.max(0, Math.min(height - 1, y + (((dir / 3) | 0) - 1)));
      scatter(x, y, T_FOREST);
    }
  }

  return { width, height, cells, seed: seed >>> 0 };
}

export function mapToString(map) {
  const chars = ".RFX#";
  let s = "";
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      s += chars[map.cells[y * map.width + x]] || "?";
    }
    s += "\n";
  }
  return s;
}
