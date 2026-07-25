// test/milestone0.test.js
// Milestone 0 parity fixture runner — includes 0F map generation.
// Uses Node built-in test runner — no external dependencies.
// Run: node --test test/milestone0.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createByteWriter, computeFnv1a64, hashToHex64 } from "../shared/canonical.js";
import { mix32, seedSfc32, sfc32Next } from "../shared/prng.js";
import {
  clampI32, floorDivI32, cellToWorld, worldToCellFloor, absI32, manhattanDistanceI32
} from "../shared/fixedmath.js";
import { generateMap } from "../engine/mapgen.js";

function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
}

// ── 0A: Byte writer primitives ────────────────────────────────────────────────
test("0A byte writer primitives", () => {
  const fx = loadFixture("0A_byte_writer_primitives.json");
  for (const c of fx.cases) {
    const w = createByteWriter();
    if (c.op === "writeU8")           w.writeU8(c.input);
    else if (c.op === "writeU16LE")   w.writeU16LE(c.input);
    else if (c.op === "writeU32LE")   w.writeU32LE(c.input);
    else if (c.op === "writeI32LE")   w.writeI32LE(c.input);
    else if (c.op === "writeBool")    w.writeBool(c.input);
    else if (c.op === "writeOptionalU32") w.writeOptionalU32(c.isPresent, c.value);
    else if (c.op === "writeBytes")   w.writeBytes(c.input);
    else if (c.op === "writeUtf8U16") w.writeUtf8U16(c.input);
    const actual = Array.from(w.toBytes());
    assert.deepEqual(actual, c.expectedBytes, `0A case ${c.id}`);
  }
});

// ── 0A: Rejection tests ───────────────────────────────────────────────────────
test("0A byte writer rejects invalid inputs", () => {
  const w = createByteWriter();
  assert.throws(() => w.writeU8(256),           /RangeError/, "u8 > 255 must throw");
  assert.throws(() => w.writeU8(-1),            /RangeError/, "u8 < 0 must throw");
  assert.throws(() => w.writeU16LE(-1),         /RangeError/, "u16 < 0 must throw");
  assert.throws(() => w.writeU32LE(-1),         /RangeError/, "u32 < 0 must throw");
  assert.throws(() => w.writeI32LE(2147483648), /RangeError/, "i32 > max must throw");
  assert.throws(() => w.writeI32LE(-2147483649),/RangeError/, "i32 < min must throw");
  assert.throws(() => w.writeU8(1.5),           /RangeError/, "float must throw");
});

// ── 0B: FNV-1a 64-bit vectors ─────────────────────────────────────────────────
test("0B FNV-1a 64-bit standard vectors", () => {
  const fx = loadFixture("0B_fnv1a64_vectors.json");
  for (const c of fx.cases) {
    const { hashHi, hashLo } = computeFnv1a64(new Uint8Array(c.inputBytes));
    const hex = hashToHex64(hashHi, hashLo);
    assert.equal(hex, c.expectedHex, `0B case ${c.id}: got ${hex}`);
  }
});

// ── 0C: mix32 vectors ─────────────────────────────────────────────────────────
test("0C mix32 vectors", () => {
  const fx = loadFixture("0C_mix32_vectors.json");
  for (const c of fx.cases) {
    const actual = mix32(c.input);
    assert.equal(actual, c.expectedU32, `0C case ${c.id}: got ${actual}`);
  }
});

// ── 0D: sfc32 pinned vectors ──────────────────────────────────────────────────
test("0D sfc32 pinned vectors", () => {
  const fx = loadFixture("0D_sfc32_vectors.json");
  for (const c of fx.cases) {
    const state0 = seedSfc32(c.rootSeed);
    assert.equal(state0.a, c.expectedInitialState.a, `0D ${c.id} initial a`);
    assert.equal(state0.b, c.expectedInitialState.b, `0D ${c.id} initial b`);
    assert.equal(state0.c, c.expectedInitialState.c, `0D ${c.id} initial c`);
    assert.equal(state0.d, c.expectedInitialState.d, `0D ${c.id} initial d`);
    const outputs = [];
    let s = state0;
    for (let i = 0; i < 8; i++) {
      const r = sfc32Next(s); outputs.push(r.value); s = r.nextState;
    }
    assert.deepEqual(outputs, c.expectedFirst8, `0D ${c.id} first 8 outputs`);
    const w = createByteWriter();
    for (const v of outputs) w.writeU32LE(v);
    const { hashHi, hashLo } = computeFnv1a64(w.toBytes());
    const seqHash = hashToHex64(hashHi, hashLo);
    assert.equal(seqHash, c.expectedSequenceHashFnv1a64, `0D ${c.id} sequence hash`);
  }
});

// ── 0E: Fixed-point helpers ───────────────────────────────────────────────────
test("0E fixedmath vectors", () => {
  const fx = loadFixture("0E_fixedmath_vectors.json");
  const ops = { clampI32, floorDivI32, cellToWorld, worldToCellFloor, absI32, manhattanDistanceI32 };
  for (const c of fx.cases) {
    const fn = ops[c.op];
    assert.ok(fn, `0E: unknown op ${c.op}`);
    const actual = fn(...c.args);
    assert.equal(actual, c.expected, `0E case ${c.id}: got ${actual}`);
  }
});

// ── 0F: Map generation — 8x8 pinned fixtures ─────────────────────────────────
test("0F map generation 8x8 pinned", () => {
  const fx = loadFixture("0F_map_8x8.json");
  for (const c of fx.cases) {
    const result = generateMap(c.rootSeed, c.width, c.height);

    // Cell-by-cell match
    assert.equal(result.cells.length, c.expectedCells.length,
      `0F ${c.id}: cell array length mismatch`);
    for (let i = 0; i < c.expectedCells.length; i++) {
      assert.equal(result.cells[i], c.expectedCells[i],
        `0F ${c.id}: cell[${i}] got ${result.cells[i]} expected ${c.expectedCells[i]}`);
    }

    // FNV-1a 64-bit hash of the full cell array
    const { hashHi, hashLo } = computeFnv1a64(result.cells);
    const hex = hashToHex64(hashHi, hashLo);
    assert.equal(hex, c.expectedHashFnv1a64,
      `0F ${c.id}: map hash got ${hex} expected ${c.expectedHashFnv1a64}`);
  }
});

// ── 0F: Map generation — structural invariants ────────────────────────────────
test("0F map generation structural invariants", () => {
  const SEEDS = [0, 1, 42, 999, 0xDEADBEEF >>> 0];
  const VALID_TERRAIN = new Set([0, 1, 2, 3, 4]);

  for (const seed of SEEDS) {
    const result = generateMap(seed, 8, 8);

    // All cells are valid terrain IDs
    for (let i = 0; i < result.cells.length; i++) {
      assert.ok(VALID_TERRAIN.has(result.cells[i]),
        `seed ${seed} cell[${i}] invalid terrain id ${result.cells[i]}`);
    }

    // Road spine at row 4 (midY = floor(8/2) = 4)
    for (let x = 0; x < 8; x++) {
      assert.equal(result.cells[4 * 8 + x], 1,
        `seed ${seed}: road missing at row 4 col ${x}`);
    }

    // Team 0 base zone (1,1)-(2,2) must be open
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      assert.equal(result.cells[(1+dy)*8+(1+dx)], 0,
        `seed ${seed}: team0 base cell (${1+dx},${1+dy}) not open`);
    }

    // Team 1 base zone (5,5)-(6,6) must be open
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      assert.equal(result.cells[(5+dy)*8+(5+dx)], 0,
        `seed ${seed}: team1 base cell (${5+dx},${5+dy}) not open`);
    }

    // Reproducibility: same seed must produce identical output
    const result2 = generateMap(seed, 8, 8);
    assert.deepEqual(Array.from(result.cells), Array.from(result2.cells),
      `seed ${seed}: map not reproducible`);
  }
});

// ── 0F: Map generation — boundary rejection ───────────────────────────────────
test("0F map generation rejects invalid dimensions", () => {
  assert.throws(() => generateMap(1, 3, 8),   /RangeError/, "width 3 must throw");
  assert.throws(() => generateMap(1, 8, 3),   /RangeError/, "height 3 must throw");
  assert.throws(() => generateMap(1, 257, 8), /RangeError/, "width 257 must throw");
  assert.throws(() => generateMap(1, 8, 257), /RangeError/, "height 257 must throw");
});
