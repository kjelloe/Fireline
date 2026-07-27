// client/js/sprite_frames.js — 14D: the pure math between engine headings
// and baked rotation sheets (tools/bake_sprites.mjs). Frame f was baked at
// heading brads f*16 (rotation.y = pi/2 - f*pi/8), so the client maps
// brads -> nearest frame. The 2D fallback renderer and the minimap icons
// both read through this module.

export const SPRITE_TILE = 64;
export const SPRITE_FRAMES = 16;

// Nearest baked frame for an engine heading (brads 0-255, any integer).
export function frameForBrads(brads) {
  const b = ((Math.round(brads ?? 0) % 256) + 256) % 256;
  return Math.round(b / (256 / SPRITE_FRAMES)) % SPRITE_FRAMES;
}

export function sheetName(key, team) {
  return `${key}_t${team === 1 ? 1 : 0}.png`;
}

// Source rect of a frame inside its sheet (manifest gives frames per key;
// static sheets have 1 frame and ignore the heading).
export function frameRect(frames, brads) {
  const f = frames > 1 ? frameForBrads(brads) : 0;
  return { sx: f * SPRITE_TILE, sy: 0, sw: SPRITE_TILE, sh: SPRITE_TILE };
}
