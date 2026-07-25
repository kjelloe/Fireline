// shared/prng.js — splitmix32 + sfc32

export function seedSfc32(seed) {
  let a = seed >>> 0;
  let b = 0x9e3779b9;
  let c = 0x85ebca6b;
  let d = 0xc2b2ae35;

  // Mix
  a = (a + 0x9e3779b9) >>> 0;
  b = (b ^ a) >>> 0;
  d = (d + a) >>> 0;
  d = ((d << 5) | (d >>> 27)) >>> 0;

  return { a, b, c, d };
}

export function sfc32Next(state) {
  const a = (state.a + 0x9e3779b9) >>> 0;
  const b = (state.b + a) >>> 0;
  const c = (state.c + b) >>> 0;
  const d = (state.d + c) >>> 0;
  return { value: a, nextState: { a, b, c, d } };
}

export function mix32(z) {
  z = (z + 0x9e3779b9) >>> 0;
  let z1 = z;
  z1 = (z1 ^ (z1 >>> 16)) >>> 0;
  z1 = Math.imul(z1, 0x21f0aaad) >>> 0;
  z1 = (z1 ^ (z1 >>> 15)) >>> 0;
  z1 = Math.imul(z1, 0x735a2d97) >>> 0;
  z1 = (z1 ^ (z1 >>> 15)) >>> 0;
  return z1;
}
