// shared/prng.js
// mix32 seed expansion and sfc32 PRNG.
// Restricted subset: no classes, no this, no null, plain functions only.
// All values are unsigned 32-bit integers.
// PRNG state is an explicit plain object — never hidden in a closure.

// ── mix32 ─────────────────────────────────────────────────────────────────────
// Finaliser-style hash used to expand a root seed into distinct words.
// Algorithm: variant of the finalisation step from MurmurHash3 / Chris Wellons.

function mix32(v) {
  v = v >>> 0;
  v = (v ^ (v >>> 16)) >>> 0;
  v = Math.imul(v, 0x45d9f3b) >>> 0;
  v = (v ^ (v >>> 16)) >>> 0;
  v = Math.imul(v, 0x45d9f3b) >>> 0;
  v = (v ^ (v >>> 16)) >>> 0;
  return v >>> 0;
}

// ── sfc32 seed expansion ──────────────────────────────────────────────────────
// Expand one root seed into the four-word sfc32 initial state.
// Each word is derived by applying mix32 to a distinct seed+offset value.

function seedSfc32(rootSeed) {
  const s = rootSeed >>> 0;
  return {
    a: mix32((s + 1) >>> 0),
    b: mix32((s + 2) >>> 0),
    c: mix32((s + 3) >>> 0),
    d: mix32((s + 4) >>> 0)
  };
}

// ── sfc32 step ────────────────────────────────────────────────────────────────
// Pure functional: takes explicit state, returns { value, nextState }.
// Algorithm: Small Fast Counting PRNG (Chris Doty-Humphrey).

function sfc32Next(state) {
  let a = state.a >>> 0;
  let b = state.b >>> 0;
  let c = state.c >>> 0;
  let d = state.d >>> 0;

  const t = (a + b + d) >>> 0;
  d = (d + 1) >>> 0;
  a = (b ^ (b >>> 9)) >>> 0;
  b = (c + (c << 3)) >>> 0;
  c = ((c << 21) | (c >>> 11)) >>> 0;
  c = (c + t) >>> 0;

  return { value: t, nextState: { a, b, c, d } };
}

export { mix32, seedSfc32, sfc32Next };
