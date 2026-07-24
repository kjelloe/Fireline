// engine/mapgen.js
// Deterministic map generator — Milestone 0F/0G.
// Pure function: (seed, width, height, options) -> { cells, width, height, seed }
// cells is a Uint8Array of terrain IDs matching data/rules.json.
// No I/O, no clocks, no hidden state. Luau-portable logic only.

import { seedSfc32, sfc32Next } from "../shared/prng.js";
import { clampI32 } from "../shared/fixedmath.js";

// Terrain IDs (must match data/rules.json)
const T_OPEN     = 0;
const T_ROAD     = 1;
const T_FOREST   = 2;
const T_ROUGH    = 3;
const T_BLOCKING = 4;

// ── Internal helpers ──────────────────────────────────────────────────────────

function cellIndex(x, y, width) {
  return y * width + x;
}

function inBounds(x, y, width, height) {
  return x >= 0 && x < width && y >= 0 && y < height;
}

// Draw a single PRNG value scaled to [0, max) using rejection-free modulo.
// For small max values the bias is negligible and determinism is preserved.
function prngBelow(state, max) {
  const r = sfc32Next(state);
  return { value: (r.value >>> 0) % max, nextState: r.nextState };
}

// ── Phase 1: base fill ────────────────────────────────────────────────────────
// Fill every cell with T_OPEN.

function phaseFill(cells, width, height) {
  for (let i = 0; i < width * height; i++) cells[i] = T_OPEN;
}

// ── Phase 2: scatter rough terrain ───────────────────────────────────────────
// Randomly place T_ROUGH tiles. roughCount driven by options.roughFraction.

function phaseScatterRough(cells, width, height, state, roughCount) {
  let s = state;
  for (let i = 0; i < roughCount; i++) {
    const rx = prngBelow(s, width);  s = rx.nextState;
    const ry = prngBelow(s, height); s = ry.nextState;
    const idx = cellIndex(rx.value, ry.value, width);
    if (cells[idx] === T_OPEN) cells[idx] = T_ROUGH;
  }
  return s;
}

// ── Phase 3: grow forest clumps ───────────────────────────────────────────────
// Place clumpCount seed cells, then expand each by up to spreadRadius steps.

function phaseGrowForest(cells, width, height, state, clumpCount, spreadRadius) {
  let s = state;
  for (let c = 0; c < clumpCount; c++) {
    const sx = prngBelow(s, width);  s = sx.nextState;
    const sy = prngBelow(s, height); s = sy.nextState;
    cells[cellIndex(sx.value, sy.value, width)] = T_FOREST;

    for (let step = 0; step < spreadRadius; step++) {
      const dx = prngBelow(s, 3); s = dx.nextState; // 0,1,2 -> -1,0,1
      const dy = prngBelow(s, 3); s = dy.nextState;
      const nx = clampI32(sx.value + (dx.value - 1), 0, width - 1);
      const ny = clampI32(sy.value + (dy.value - 1), 0, height - 1);
      if (cells[cellIndex(nx, ny, width)] === T_OPEN) {
        cells[cellIndex(nx, ny, width)] = T_FOREST;
      }
    }
  }
  return s;
}

// ── Phase 4: stamp base zones ─────────────────────────────────────────────────
// Two teams: team 0 base top-left quadrant, team 1 base bottom-right quadrant.
// Base zone is a 2x2 block of T_OPEN (clears any terrain placed earlier).

function phaseStampBases(cells, width, height) {
  // Team 0 base: top-left corner
  const b0x = 1, b0y = 1;
  // Team 1 base: bottom-right corner
  const b1x = width - 3, b1y = height - 3;

  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      cells[cellIndex(b0x + dx, b0y + dy, width)] = T_OPEN;
      cells[cellIndex(b1x + dx, b1y + dy, width)] = T_OPEN;
    }
  }
}

// ── Phase 5: stamp a road spine ───────────────────────────────────────────────
// Horizontal road through vertical midpoint, full width.

function phaseStampRoad(cells, width, height) {
  const midY = Math.floor(height / 2);
  for (let x = 0; x < width; x++) {
    cells[cellIndex(x, midY, width)] = T_ROAD;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

function generateMap(rootSeed, width, height, options) {
  const w = (width  || 8)  >>> 0;
  const h = (height || 8)  >>> 0;
  const opts = options || {};

  if (w < 4 || w > 256) throw new RangeError("width must be 4–256");
  if (h < 4 || h > 256) throw new RangeError("height must be 4–256");

  const roughFraction  = (opts.roughFraction  !== undefined) ? opts.roughFraction  : 0.10;
  const forestClumps   = (opts.forestClumps   !== undefined) ? opts.forestClumps   : 3;
  const forestSpread   = (opts.forestSpread   !== undefined) ? opts.forestSpread   : 4;
  const stampRoad      = (opts.stampRoad      !== undefined) ? opts.stampRoad      : true;
  const stampBases     = (opts.stampBases     !== undefined) ? opts.stampBases     : true;

  const totalCells  = w * h;
  const roughCount  = Math.max(0, Math.floor(totalCells * roughFraction));

  const cells = new Uint8Array(totalCells);

  // Phase 1: fill
  phaseFill(cells, w, h);

  // Seed PRNG
  let state = seedSfc32(rootSeed >>> 0);

  // Phase 2: rough scatter
  state = phaseScatterRough(cells, w, h, state, roughCount);

  // Phase 3: forest clumps
  state = phaseGrowForest(cells, w, h, state, forestClumps, forestSpread);

  // Phase 4: base zones (always clear, no PRNG consumed)
  if (stampBases) phaseStampBases(cells, w, h);

  // Phase 5: road spine (always clear, no PRNG consumed)
  if (stampRoad) phaseStampRoad(cells, w, h);

  return { cells, width: w, height: h, seed: rootSeed >>> 0 };
}

// Pretty-print a map to a string for headless inspection
function mapToString(mapResult) {
  const symbols = ['.', '=', 'F', '~', '#'];
  const { cells, width, height } = mapResult;
  const lines = [];
  for (let y = 0; y < height; y++) {
    let row = "";
    for (let x = 0; x < width; x++) {
      row += symbols[cells[cellIndex(x, y, width)]] + " ";
    }
    lines.push(row.trimEnd());
  }
  return lines.join("\n");
}

export { generateMap, mapToString, T_OPEN, T_ROAD, T_FOREST, T_ROUGH, T_BLOCKING };
