// test/milestone0.test.js
// Milestone 0 parity fixture runner.
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
    // Verify initial state
    const state0 = seedSfc32(c.rootSeed);
    assert.equal(state0.a, c.expectedInitialState.a, `0D ${c.id} initial a`);
    assert.equal(state0.b, c.expectedInitialState.b, `0D ${c.id} initial b`);
    assert.equal(state0.c, c.expectedInitialState.c, `0D ${c.id} initial c`);
    assert.equal(state0.d, c.expectedInitialState.d, `0D ${c.id} initial d`);

    // Verify first 8 outputs
    const outputs = [];
    let s = state0;
    for (let i = 0; i < 8; i++) {
      const r = sfc32Next(s);
      outputs.push(r.value);
      s = r.nextState;
    }
    assert.deepEqual(outputs, c.expectedFirst8, `0D ${c.id} first 8 outputs`);

    // Verify sequence hash
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
