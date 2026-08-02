// client/js/fog_model.js — the fog-of-war OVERLAY mask (prompt 147).
// Pure presentation on the 16G/ambients precedent: a per-cell "can my
// team see this ground" mask computed from the fog-filtered VIEW alone
// (own assets + owned sites — exactly the engine's sensor set in
// engine/los.js computeVisible, replicated cell-for-cell so the sheen's
// edge IS the spotting edge). Nothing here talks to the engine at
// runtime; the constants are imported so a sensor retune moves the
// overlay automatically.
//
// Engine truth replicated (los.js):
//   - sensors: my non-wreck assets — radius 12 (6 while suppressed),
//     HALVED during a weather front, +6 while we own a live RADAR;
//   - owned live sites: RELAY_FOG_CELLS 16 (halved in storm; radar
//     bonus does NOT apply to sites — same as the engine);
//   - all distances Chebyshev, so visibility is squares, and the
//     overlay honestly renders squares (the smoke puffs happen at
//     exactly these edges).

import {
  FOG_RADIUS_CELLS, SUPPRESSED_RADIUS_CELLS, weatherWindow,
} from "../../engine/los.js";
import { RELAY_FOG_CELLS, KIND_RADAR, RADAR_BONUS_CELLS } from "../../engine/sites.js";

const ASSET_DISABLED = 2;
const ASSET_SALVAGED = 3;

// Fill a Chebyshev square of `radius` cells around (cx, cy) with 1.
function paint(mask, width, height, cx, cy, radius) {
  const x0 = Math.max(0, cx - radius);
  const x1 = Math.min(width - 1, cx + radius);
  const y0 = Math.max(0, cy - radius);
  const y1 = Math.min(height - 1, cy + radius);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) mask[y * width + x] = 1;
  }
}

// Uint8Array(width*height): 1 = my team can spot ground here, 0 = fog.
// `view` is the player's own fog-filtered view; spectators (myTeam -1)
// should not call this — they see everything.
export function fogMask(view, myTeam, mapSeed, tick, width, height) {
  const mask = new Uint8Array(width * height);
  if (!view || myTeam === -1) {
    mask.fill(1);
    return mask;
  }
  const w = weatherWindow(mapSeed >>> 0);
  const storm = tick >= w.start && tick < w.end;
  const radar = (view.sites ?? []).some((s) =>
    s.owner === myTeam && s.kind === KIND_RADAR && (s.hp ?? 1) > 0);
  const bonus = radar ? RADAR_BONUS_CELLS : 0;
  for (const a of view.friendlyAssets ?? []) {
    if (a.team !== myTeam) continue; // spectator views carry both teams
    if (a.state === ASSET_DISABLED || a.state === ASSET_SALVAGED) continue;
    const base = (a.suppressedTimer ?? 0) > 0 ? SUPPRESSED_RADIUS_CELLS : FOG_RADIUS_CELLS;
    const r = (storm ? base >> 1 : base) + bonus;
    paint(mask, width, height, a.x >> 8, a.y >> 8, r);
  }
  for (const s of view.sites ?? []) {
    if (s.owner !== myTeam || (s.hp ?? 1) <= 0) continue;
    const r = storm ? RELAY_FOG_CELLS >> 1 : RELAY_FOG_CELLS;
    paint(mask, width, height, s.cellX, s.cellY, r);
  }
  // Prompt 160 item 2: the compound watches itself — your own base
  // rect (+1 verge) is always lit, matching engine/los.js exactly.
  const ownBase = (view.bases ?? []).find((b) => b.team === myTeam);
  if (ownBase) {
    for (let y = Math.max(0, ownBase.y - 1); y <= Math.min(height - 1, ownBase.y + ownBase.height); y++) {
      for (let x = Math.max(0, ownBase.x - 1); x <= Math.min(width - 1, ownBase.x + ownBase.width); x++) {
        mask[y * width + x] = 1;
      }
    }
  }
  return mask;
}
