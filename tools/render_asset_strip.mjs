#!/usr/bin/env node
// tools/render_asset_strip.mjs — demo asset strip PNG for human assessment
// (design ruling Q9b). Software-rasterizes every procedural stand-in from
// asset_factory (no WebGL/GPU): isometric projection, flat lambert shading,
// painter's algorithm, hand-rolled PNG encoder. Deterministic byte-for-byte.
// Output: client/assets/preview/asset_strip.png    Run: npm run strip

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import {
  setStyleTokens, buildProcedural, proceduralKeys, applyTeamColor,
} from "../client/js/asset_factory.js";
import { hex, trianglesOf, makeProjector, makeShader, encodePng } from "./soft_raster.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(readFileSync(path.join(ROOT, "client/assets/metadata/style_tokens.json")));
setStyleTokens(tokens);

// ── layout ────────────────────────────────────────────────────────────────────
const TILE = 176;          // px per asset tile
const LABEL_H = 18;
const SCALE = 64;          // px per world unit
const YAW = Math.PI / 4;
const PITCH = 0.6;         // ~34 degrees — the diorama band from the art spec
const BG = hex(tokens.terrainPalette?.open ?? "#77995a");
const PANEL = [24, 24, 32];

// ── projection + shading (shared core, strip's own constants) ─────────────────
const project = makeProjector(YAW, PITCH);
const shade = makeShader(new THREE.Vector3(-0.35, 0.9, 0.5));

// ── rasterizer ────────────────────────────────────────────────────────────────
function drawTile(buf, stripW, xOff, tris) {
  const cx = xOff + TILE / 2;
  const cy = TILE * 0.62;
  const put = (x, y, rgb) => {
    if (x < xOff + 1 || x >= xOff + TILE - 1 || y < 1 || y >= TILE) return;
    const o = (y * stripW + x) * 4;
    buf[o] = rgb[0]; buf[o + 1] = rgb[1]; buf[o + 2] = rgb[2]; buf[o + 3] = 255;
  };

  // ground shadow disc
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -34; dx <= 34; dx++) {
      if ((dx * dx) / (34 * 34) + (dy * dy) / (10 * 10) <= 1) {
        put(cx + dx, Math.round(cy + 14 + dy * 0.6), [58, 74, 48]);
      }
    }
  }

  const projected = tris.map((t) => {
    const pa = project(t.a), pb = project(t.b), pc = project(t.c);
    return {
      x: [cx + pa.sx * SCALE, cx + pb.sx * SCALE, cx + pc.sx * SCALE],
      y: [cy - pa.sy * SCALE, cy - pb.sy * SCALE, cy - pc.sy * SCALE],
      depth: (pa.depth + pb.depth + pc.depth) / 3,
      rgb: shade(t),
    };
  }).sort((p, q) => p.depth - q.depth); // far first, near last

  for (const t of projected) {
    const minX = Math.max(xOff, Math.floor(Math.min(...t.x)));
    const maxX = Math.min(xOff + TILE - 1, Math.ceil(Math.max(...t.x)));
    const minY = Math.max(0, Math.floor(Math.min(...t.y)));
    const maxY = Math.min(TILE - 1, Math.ceil(Math.max(...t.y)));
    const [x0, x1, x2] = t.x, [y0, y1, y2] = t.y;
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-6) continue;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const w0 = ((x1 - x) * (y2 - y) - (x2 - x) * (y1 - y)) / area;
        const w1 = ((x2 - x) * (y0 - y) - (x0 - x) * (y2 - y)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 >= -1e-6 && w1 >= -1e-6 && w2 >= -1e-6) put(x, y, t.rgb);
      }
    }
  }
}

// ── tiny 3x5 label font ───────────────────────────────────────────────────────
const FONT = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101110100110101", L: "100100100100111",
  M: "101111111101101", N: "101111111111101", O: "010101101101010", P: "110101110100100",
  Q: "010101101011001", R: "110101110110101", S: "011100010001110", T: "111010010010010",
  U: "101101101101011", V: "101101101010010", W: "101101111111101", X: "101010010010101",
  Y: "101101010010010", Z: "111001010100111", _: "000000000000111", " ": "000000000000000",
  0: "010101101101010", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110",
  4: "101101111001001", 5: "111100110001110", 6: "011100110101010", 7: "111001010010010",
  8: "010101010101010", 9: "010101011001110",
};

function drawLabel(buf, stripW, xOff, yOff, text) {
  const chars = text.toUpperCase().split("").slice(0, 20);
  const width = chars.length * 8;
  let px = xOff + Math.round((TILE - width) / 2);
  for (const ch of chars) {
    const glyph = FONT[ch] ?? FONT[" "];
    for (let i = 0; i < 15; i++) {
      if (glyph[i] !== "1") continue;
      const gx = i % 3, gy = (i / 3) | 0;
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const o = ((yOff + gy * 2 + sy) * stripW + px + gx * 2 + sx) * 4;
          buf[o] = 235; buf[o + 1] = 235; buf[o + 2] = 220; buf[o + 3] = 255;
        }
      }
    }
    px += 8;
  }
}


// ── compose the strip ─────────────────────────────────────────────────────────
const keys = proceduralKeys();
const teamColor = { 0: tokens.teams[0].color, 1: tokens.teams[1].color };
const items = keys.map((key) => ({ key, tint: teamColor[0] }));
items.push({ key: "standard_upright", tint: teamColor[1], label: "standard_red" });

const stripW = items.length * TILE;
const stripH = TILE + LABEL_H;
const buf = Buffer.alloc(stripW * stripH * 4);
for (let y = 0; y < stripH; y++) {
  for (let x = 0; x < stripW; x++) {
    const o = (y * stripW + x) * 4;
    const c = y < TILE ? BG : PANEL;
    buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255;
  }
}

items.forEach((item, i) => {
  const group = buildProcedural(item.key);
  applyTeamColor(group, item.tint);
  drawTile(buf, stripW, i * TILE, trianglesOf(group));
  drawLabel(buf, stripW, i * TILE, TILE + 3, item.label ?? item.key);
  // tile separator
  for (let y = 0; y < stripH; y++) {
    const o = (y * stripW + i * TILE) * 4;
    buf[o] = 40; buf[o + 1] = 40; buf[o + 2] = 52; buf[o + 3] = 255;
  }
});

const outDir = path.join(ROOT, "client/assets/preview");
mkdirSync(outDir, { recursive: true });
const png = encodePng(stripW, stripH, buf);
writeFileSync(path.join(outDir, "asset_strip.png"), png);
console.log(`asset strip: ${items.length} tiles, ${stripW}x${stripH}, ${png.length} bytes -> client/assets/preview/asset_strip.png`);
