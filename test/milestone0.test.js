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
test("0A byte writer primitives", (t) => {
  const fx = loadFixture("0A_byte_writer_primitives.json");
  for (const c of fx.cases) {
    const w = createByteWriter();
    if (c.op === "writeU8")         w.writeU8(c.input);
    else if (c.op === "writeU16LE") w.writeU16LE(c.input);
    else if (c.op === "writeU32LE") w.writeU32LE(c.input);
    else if (c.op === "writeI32LE") w.writeI32LE(c.input);
    else if (c.op === "writeBool")  w.writeBool(c.input);
    else if (c.op === "writeOptionalU32") w.writeOptionalU32(c.isPresent, c.value);
    else if (c.op === "writeBytes") w.writeBytes(c.input);
    else if (c.op === "writeUtf8U16") w.writeUtf8U16(c.input);
    const actual = Array.from(w.toBytes());
    assert.deepEqual(actual, c.expectedBytes, `0A case ${c.id}`);
  }
});

// ── 0A: Rejection tests ───────────────────────────────────────────────────────
test("0A byte writer rejects invalid inputs", () => {
  const w = createByteWriter();
  assert.throws(() => w.writeU8(256),    /RangeError/, "u8 > 255 must throw");
  assert.throws(() => w.writeU8(-1),     /RangeError/, "u8 < 0 must throw");
  assert.throws(() => w.writeU16LE(-1),  /RangeError/, "u16 < 0 must throw");
  assert.throws(() => w.writeU32LE(-1),  /RangeError/, "u32 < 0 must throw");
  assert.throws(() => w.writeI32LE(2147483648),  /RangeError/, "i32 > max must throw");
  assert.throws(() => w.writeI32LE(-2147483649), /RangeError/, "i32 < min must throw");
  assert.throws(() => w.writeU8(1.5),    /RangeError/, "float must throw");
});

// ── 0B: FNV-1a 64-bit vectors ─────────────────────────────────────────────────
test("0B FNV-1a 64-bit standard vectors", () => {
  const fx = loadFixture("0B_fnv1a64_vectors.json");
  for (const c of fx.cases) {
    if (c.id === "u32_le") continue; // skip self-referential case until pinned
    const { hashHi, hashLo } = computeFnv1a64(new Uint8Array(c.inputBytes));
    const hex = hashToHex64(hashHi, hashLo);
    assert.equal(hex, c.expectedHex, `0B case ${c.id}: got ${hex}`);
  }
});

// ── 0C: mix32 vectors ─────────────────────────────────────────────────────────
test("0C mix32 vectors", () => {
  const fx = loadFixture("0C_mix32_vectors.json");
  for (const c of fx.cases) {
    if (typeof c.expectedU32 !== "number") continue;
    const actual = mix32(c.input);
    assert.equal(actual, c.expectedU32, `0C case ${c.id}: got ${actual}`);
  }
});

// ── 0D: sfc32 smoke test (self-pinning) ───────────────────────────────────────
test("0D sfc32 produces consistent outputs for seed 1", () => {
  const state0 = seedSfc32(1);
  // Verify state is four u32 words
  assert.ok(state0.a >= 0 && state0.a <= 4294967295, "a is u32");
  assert.ok(state0.b >= 0 && state0.b <= 4294967295, "b is u32");
  assert.ok(state0.c >= 0 && state0.c <= 4294967295, "c is u32");
  assert.ok(state0.d >= 0 && state0.d <= 4294967295, "d is u32");
  // Run 8 steps and verify reproducibility
  const run1 = []; let s = state0;
  for (let i = 0; i < 8; i++) { const r = sfc32Next(s); run1.push(r.value); s = r.nextState; }
  const run2 = []; s = state0;
  for (let i = 0; i < 8; i++) { const r = sfc32Next(s); run2.push(r.value); s = r.nextState; }
  assert.deepEqual(run1, run2, "sfc32 must be reproducible from same initial state");
  // All outputs must be u32
  for (const v of run1) assert.ok(v >= 0 && v <= 4294967295, `output ${v} is u32`);
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
