// test/sprite_frames.test.js — 14D: brads -> baked frame mapping. The
// convention is load-bearing on both sides (baker writes it, renderer
// reads it), so it is pinned here plus a manifest smoke over the real
// baked output when present.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { frameForBrads, frameRect, sheetName, SPRITE_FRAMES, SPRITE_TILE } from "../client/js/sprite_frames.js";

test("frameForBrads: baked convention — frame f lives at brads f*16", () => {
  for (let f = 0; f < SPRITE_FRAMES; f++) {
    assert.equal(frameForBrads(f * 16), f);
  }
  assert.equal(frameForBrads(7), 0, "rounds to nearest frame");
  assert.equal(frameForBrads(9), 1);
  assert.equal(frameForBrads(255), 0, "wraps: 255 is nearest to frame 0");
  assert.equal(frameForBrads(-16), 15, "negative brads wrap");
});

test("frameRect: statics ignore heading, rotatables select by it", () => {
  assert.deepEqual(frameRect(1, 200), { sx: 0, sy: 0, sw: SPRITE_TILE, sh: SPRITE_TILE });
  assert.equal(frameRect(16, 32).sx, 2 * SPRITE_TILE);
});

test("sheet naming matches the baker", () => {
  assert.equal(sheetName("tank", 0), "tank_t0.png");
  assert.equal(sheetName("wreck_skimmer", 1), "wreck_skimmer_t1.png");
});

test("baked manifest (when present) agrees with the module constants", () => {
  const p = new URL("../client/assets/sprites/manifest.json", import.meta.url).pathname;
  if (!existsSync(p)) return; // baking is a build step, not a test dependency
  const manifest = JSON.parse(readFileSync(p));
  assert.equal(manifest.tile, SPRITE_TILE);
  for (const [key, meta] of Object.entries(manifest.sheets)) {
    assert.ok(meta.frames === 1 || meta.frames === SPRITE_FRAMES, `${key}: ${meta.frames}`);
    assert.ok(existsSync(new URL(`../client/assets/sprites/${sheetName(key, 0)}`, import.meta.url).pathname));
    assert.ok(existsSync(new URL(`../client/assets/sprites/${sheetName(key, 1)}`, import.meta.url).pathname));
  }
});
