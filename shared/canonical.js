// shared/canonical.js
// Canonical byte writer and FNV-1a 64-bit hash.
// Restricted subset: no classes, no this, no null, plain functions only.
// All multi-byte values are little-endian.

// ── Validation helpers ────────────────────────────────────────────────────────

function assertU8(v) {
  if (!Number.isInteger(v) || v < 0 || v > 255)
    throw new RangeError("u8 out of range: " + v);
}
function assertU16(v) {
  if (!Number.isInteger(v) || v < 0 || v > 65535)
    throw new RangeError("u16 out of range: " + v);
}
function assertU32(v) {
  if (!Number.isInteger(v) || v < 0 || v > 4294967295)
    throw new RangeError("u32 out of range: " + v);
}
function assertI32(v) {
  if (!Number.isInteger(v) || v < -2147483648 || v > 2147483647)
    throw new RangeError("i32 out of range: " + v);
}

// ── Byte writer ───────────────────────────────────────────────────────────────

function createByteWriter(capacity) {
  const cap = capacity || 8192;
  const buf = new Uint8Array(cap);
  let pos = 0;

  function checkRoom(n) {
    if (pos + n > cap) throw new RangeError("ByteWriter capacity exceeded");
  }

  function writeU8(v) {
    assertU8(v); checkRoom(1);
    buf[pos++] = v;
  }
  function writeU16LE(v) {
    assertU16(v); checkRoom(2);
    buf[pos++] = v & 0xFF;
    buf[pos++] = (v >>> 8) & 0xFF;
  }
  function writeU32LE(v) {
    assertU32(v); checkRoom(4);
    buf[pos++] = v & 0xFF;
    buf[pos++] = (v >>> 8) & 0xFF;
    buf[pos++] = (v >>> 16) & 0xFF;
    buf[pos++] = (v >>> 24) & 0xFF;
  }
  function writeI32LE(v) {
    assertI32(v); checkRoom(4);
    // Encode two's-complement as unsigned 32-bit, then write LE
    const u = v >>> 0;
    buf[pos++] = u & 0xFF;
    buf[pos++] = (u >>> 8) & 0xFF;
    buf[pos++] = (u >>> 16) & 0xFF;
    buf[pos++] = (u >>> 24) & 0xFF;
  }
  function writeBool(v) {
    checkRoom(1);
    buf[pos++] = v ? 1 : 0;
  }
  function writeOptionalU32(isPresent, v) {
    checkRoom(1);
    if (isPresent) {
      buf[pos++] = 1;
      writeU32LE(v);
    } else {
      buf[pos++] = 0;
    }
  }
  function writeBytes(bytes) {
    checkRoom(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[pos++] = bytes[i];
  }
  function writeUtf8U16(text) {
    const enc = new TextEncoder().encode(text);
    assertU16(enc.length);
    writeU16LE(enc.length);
    writeBytes(enc);
  }
  function toBytes() {
    return buf.slice(0, pos);
  }

  return { writeU8, writeU16LE, writeU32LE, writeI32LE,
           writeBool, writeOptionalU32, writeBytes, writeUtf8U16, toBytes };
}

// ── FNV-1a 64-bit (exact two-u32-limb implementation) ────────────────────────
//
// Standard offset basis: 0xcbf29ce484222325
// Standard prime:        0x00000100000001b3
//
// State is split into two unsigned 32-bit limbs:
//   hashHi = upper 32 bits
//   hashLo = lower 32 bits
//
// Each step: hash = (hash XOR byte) * prime  (mod 2^64)
//
// Multiplication is expanded as:
//   Let H = hashHi * 2^32 + hashLo
//   Let P = primeHi * 2^32 + primeLo   (primeHi = 0x100, primeLo = 0x1b3)
//
//   H * P mod 2^64:
//     lo = hashLo * primeLo                          (keep lower 32 bits)
//     carry from lo = upper 32 bits of hashLo*primeLo
//     hi = hashHi * primeLo + hashLo * primeHi + carry  (keep lower 32 bits)
//
// Math.imul gives the lower 32 bits of a 32x32 multiply exactly.
// Upper 32 bits of hashLo * primeLo are recovered via floating-point
// (safe because both operands fit in 32 bits and the product fits in 53-bit mantissa).

const FNV_PRIME_HI = 0x00000100;
const FNV_PRIME_LO = 0x000001B3;
const FNV_OFFSET_HI = 0xCBF29CE4;
const FNV_OFFSET_LO = 0x84222325;

function computeFnv1a64(bytes) {
  let hi = FNV_OFFSET_HI >>> 0;
  let lo = FNV_OFFSET_LO >>> 0;

  for (let i = 0; i < bytes.length; i++) {
    // XOR low limb with byte
    lo = (lo ^ bytes[i]) >>> 0;

    // Multiply [hi:lo] by [FNV_PRIME_HI:FNV_PRIME_LO] mod 2^64
    // Lower 32 bits of product
    const newLo = Math.imul(lo, FNV_PRIME_LO) >>> 0;
    // Upper 32 bits of lo * primeLo (exact via float; both fit in 32 bits)
    const loHiCarry = Math.floor((lo * FNV_PRIME_LO) / 4294967296) >>> 0;
    // Upper limb contributions (all mod 2^32)
    const newHi = (Math.imul(hi, FNV_PRIME_LO) +
                   Math.imul(lo, FNV_PRIME_HI) +
                   loHiCarry) >>> 0;

    lo = newLo;
    hi = newHi;
  }
  return { hashHi: hi, hashLo: lo };
}

function hashToHex64(hashHi, hashLo) {
  return hashHi.toString(16).padStart(8, "0") +
         hashLo.toString(16).padStart(8, "0");
}

export { createByteWriter, computeFnv1a64, hashToHex64 };
