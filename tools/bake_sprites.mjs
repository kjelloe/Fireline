#!/usr/bin/env node
// tools/bake_sprites.mjs — 14D: bake per-chassis rotation sheets from the
// SAME procedural builders the 3D client uses (soft_raster core, no GPU,
// deterministic byte-for-byte). 16 headings per rotatable key, 1 for
// statics; both team tints. Frame convention matches the engine:
//   frame f == heading brads f*16, i.e. rotation.y = pi/2 - f*pi/8
// so the client maps brads->frame with round(brads/16) % 16.
// Output: client/assets/sprites/{key}_t{team}.png + manifest.json
// Run: npm run sprites

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import {
  setStyleTokens, buildProcedural, proceduralKeys, applyTeamColor,
} from "../client/js/asset_factory.js";
import { trianglesOf, makeProjector, makeShader, encodePng } from "./soft_raster.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(readFileSync(path.join(ROOT, "client/assets/metadata/style_tokens.json")));
setStyleTokens(tokens);

const TILE = 64;
const SCALE = 26;
const project = makeProjector(Math.PI / 4, 0.6); // the strip's diorama band
const shade = makeShader(new THREE.Vector3(-0.35, 0.9, 0.5));

// Statics render one frame; everything else gets the 16-heading sheet.
const STATIC_KEYS = new Set(["relay", "command_zone", "mine", "standard_upright", "standard_dropped"]);

function drawFrame(buf, sheetW, xOff, tris) {
  const cx = xOff + TILE / 2;
  const cy = TILE * 0.62;
  const put = (x, y, rgb) => {
    if (x < xOff || x >= xOff + TILE || y < 0 || y >= TILE) return;
    const o = (y * sheetW + x) * 4;
    buf[o] = rgb[0]; buf[o + 1] = rgb[1]; buf[o + 2] = rgb[2]; buf[o + 3] = 255;
  };
  const projected = tris.map((t) => {
    const pa = project(t.a), pb = project(t.b), pc = project(t.c);
    return {
      x: [cx + pa.sx * SCALE, cx + pb.sx * SCALE, cx + pc.sx * SCALE],
      y: [cy - pa.sy * SCALE, cy - pb.sy * SCALE, cy - pc.sy * SCALE],
      depth: (pa.depth + pb.depth + pc.depth) / 3,
      rgb: shade(t),
    };
  }).sort((p, q) => p.depth - q.depth);
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
        if (w0 >= -1e-6 && w1 >= -1e-6 && 1 - w0 - w1 >= -1e-6) put(x, y, t.rgb);
      }
    }
  }
}

const outDir = path.join(ROOT, "client/assets/sprites");
mkdirSync(outDir, { recursive: true });
const teamColor = { 0: tokens.teams[0].color, 1: tokens.teams[1].color };
const manifest = { tile: TILE, sheets: {} };

for (const key of proceduralKeys()) {
  const frames = STATIC_KEYS.has(key) ? 1 : 16;
  for (const team of [0, 1]) {
    const sheetW = frames * TILE;
    const buf = Buffer.alloc(sheetW * TILE * 4); // transparent
    for (let f = 0; f < frames; f++) {
      const group = buildProcedural(key);
      applyTeamColor(group, teamColor[team]);
      group.rotation.y = Math.PI / 2 - (f * Math.PI) / 8; // brads f*16
      drawFrame(buf, sheetW, f * TILE, trianglesOf(group));
    }
    writeFileSync(path.join(outDir, `${key}_t${team}.png`), encodePng(sheetW, TILE, buf));
  }
  manifest.sheets[key] = { frames };
}

writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`baked ${Object.keys(manifest.sheets).length} keys x 2 teams -> client/assets/sprites/`);
