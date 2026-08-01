// client/js/ambients_model.js — figure-kit round 2: AMBIENT NPCs
// (designer order: farmhands → road workers → trader convoy;
// specs/12 figure-kit poses). PURE PRESENTATION on the 16G weather
// precedent: every position is a pure function of (map seed, tick,
// terrain) — nothing hashed, nothing transported, zero engine
// surface. Reactions use only the viewer's OWN fog-filtered view
// (fleeing from a unit you cannot see would leak information), so
// two clients may disagree about a farmhand's panic — cosmetics may.

import { T_OPEN, T_ROAD } from "../../engine/mapgen.js";

const FLEE_CELLS = 5;      // any visible asset this close spooks a civilian
const FLEE_SPEED = 0.02;   // cells/tick while fleeing
const WANDER_R = 2.2;      // farmhand loop radius around the homestead

function hash2(seed, a, b) {
  let h = (seed ^ (a * 0x9e3779b1) ^ (b * 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// Anchor sites, derived once from terrain (deterministic per map):
// farmhands at open-ground pockets off the roads, road workers on
// road cells, the trader walking the whole road row.
export function ambientAnchors(cells, width, height, seed) {
  const anchors = [];
  let farmhands = 0;
  let workers = 0;
  for (let cy = 8; cy < height - 8; cy += 5) {
    for (let cx = 8; cx < width - 8; cx += 5) {
      const t = cells[cy * width + cx];
      const h = hash2(seed, cx, cy);
      if (t === T_OPEN && h % 13 === 0 && farmhands < 12) {
        farmhands += 1;
        anchors.push({ kind: "farmhand", cx, cy, phase: h % 628 });
      } else if (t === T_ROAD && h % 5 === 0 && workers < 6) {
        workers += 1;
        anchors.push({ kind: "roadworker", cx, cy, phase: h % 628 });
      }
    }
  }
  // ONE trader cart, walking the map's main road row end to end.
  anchors.push({ kind: "trader", cx: width >> 1, cy: 63, phase: 0 });
  return anchors;
}

// Positions at a tick. `visible` = the viewer's visible assets (own +
// enemies they can see), each {x, y} in world units (256/cell).
export function ambientFigures(anchors, tick, visible = []) {
  const out = [];
  for (const a of anchors) {
    if (a.kind === "trader") {
      // A slow shuttle along the road row: triangle wave over x.
      const span = 80;
      const t = (tick * 0.008 + a.phase) % (span * 2);
      const x = 24 + (t < span ? t : span * 2 - t);
      out.push({ kind: "trader", x: x + 0.5, y: a.cy + 0.5, fleeing: false, pose: "walk" });
      continue;
    }
    // Wander loop around the anchor.
    const ang = tick * 0.004 + a.phase;
    let x = a.cx + 0.5 + Math.cos(ang) * (a.kind === "farmhand" ? WANDER_R : 0.4);
    let y = a.cy + 0.5 + Math.sin(ang) * (a.kind === "farmhand" ? WANDER_R * 0.6 : 0.2);
    // Flee from the nearest visible war machine (viewer-local).
    let threat = null;
    let best = FLEE_CELLS;
    for (const v of visible) {
      const d = Math.max(Math.abs(v.x / 256 - x), Math.abs(v.y / 256 - y));
      if (d < best) { best = d; threat = v; }
    }
    let fleeing = false;
    if (threat && a.kind === "farmhand") {
      fleeing = true;
      const dx = x - threat.x / 256;
      const dy = y - threat.y / 256;
      const n = Math.max(0.001, Math.hypot(dx, dy));
      const run = (FLEE_CELLS - best) * 40 * FLEE_SPEED;
      x += (dx / n) * run;
      y += (dy / n) * run;
    }
    out.push({
      kind: a.kind, x, y, fleeing,
      pose: a.kind === "roadworker" ? "kneel" : fleeing ? "run" : "walk",
    });
  }
  return out;
}
