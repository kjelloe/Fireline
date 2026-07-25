// shared/canonical.js — canonical primitives

export function createWriter() {
  const buf = [];
  return {
    u32(v) { buf.push((v >>> 0)); },
    i32(v) { buf.push((v | 0)); },
    u8(v)  { buf.push((v & 0xFF) >>> 0); },
    finish() { return new Uint8Array(buf); }
  };
}

export function assertU32(v) {
  if ((v >>> 0) !== v) throw new TypeError('expected u32');
  return v >>> 0;
}

export function assertI32(v) {
  if ((v | 0) !== v) throw new TypeError('expected i32');
  return v | 0;
}

export function fnv1a64(data) {
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0x84222325 >>> 0;
  for (let i = 0; i < data.length; i++) {
    h1 ^= data[i];
    h2 ^= data[i];
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  return [h1, h2];
}
