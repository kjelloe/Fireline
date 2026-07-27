// tools/soft_raster.mjs — the shared software rasterizer core (no WebGL,
// no GPU): triangle extraction from three.js groups, isometric projection,
// flat lambert shading, and a hand-rolled PNG encoder. Extracted VERBATIM
// from render_asset_strip.mjs for 14D so the strip tool and the sprite
// baker cannot drift; the strip PNG is byte-identical across the move.

import { deflateSync } from "node:zlib";
import * as THREE from "three";

export function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

export function trianglesOf(group) {
  group.updateMatrixWorld(true);
  const tris = [];
  group.traverse((node) => {
    if (!node.isMesh) return;
    const geo = node.geometry;
    const pos = geo.attributes.position;
    const color = node.material.color;
    const rgb = [color.r * 255, color.g * 255, color.b * 255];
    const read = (i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld);
    const count = geo.index ? geo.index.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const a = read(geo.index ? geo.index.getX(i) : i);
      const b = read(geo.index ? geo.index.getX(i + 1) : i + 1);
      const c = read(geo.index ? geo.index.getX(i + 2) : i + 2);
      tris.push({ a, b, c, rgb });
    }
  });
  return tris;
}

export function makeProjector(yaw, pitch) {
  return (p) => {
    const x1 = p.x * Math.cos(yaw) + p.z * Math.sin(yaw);
    const z1 = -p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
    const sy = p.y * Math.cos(pitch) - z1 * Math.sin(pitch);
    const depth = p.y * Math.sin(pitch) + z1 * Math.cos(pitch);
    return { sx: x1, sy, depth };
  };
}

export function makeShader(light) {
  const L = light.clone().normalize();
  return (tri) => {
    const n = new THREE.Vector3()
      .subVectors(tri.b, tri.a)
      .cross(new THREE.Vector3().subVectors(tri.c, tri.a))
      .normalize();
    const k = 0.55 + 0.45 * Math.abs(n.dot(L));
    return tri.rgb.map((v) => Math.min(255, Math.round(v * k)));
  };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
