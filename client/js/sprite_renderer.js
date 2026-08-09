// client/js/sprite_renderer.js — 14D: the 2D canvas fallback. Engages when
// WebGL is absent (or ?renderer=2d): terrain cells + baked rotation-sheet
// sprites + name labels, spectator-grade (orders need the 3D picker).
// buildDrawList is PURE (headless-tested); the renderer just blits it.

import { visualKeyFor } from "./asset_resolver.js";
import { frameRect, sheetName, SPRITE_TILE } from "./sprite_frames.js";

// One flat, z-ordered list of everything the fog lets this client see.
export function buildDrawList(view) {
  if (!view) return [];
  const ops = [];
  // World coords are cell-anchored; center on the cell like the 3D client.
  const push = (key, team, e, brads, z) =>
    ops.push({ key, team: team === 1 ? 1 : 0, x: e.x / 256 + 0.5, y: e.y / 256 + 0.5, brads: brads ?? 0, z });
  for (const site of view.sites ?? []) {
    ops.push({ key: "relay", team: site.owner === 1 ? 1 : 0, x: site.cellX + 0.5, y: site.cellY + 0.5, brads: 0, z: 0 });
  }
  for (const m of view.mines ?? []) push("mine", m.team, m, 0, 1);
  for (const st of view.standards ?? []) {
    push(st.status === 1 ? "standard_upright" : "standard_dropped", st.team, st, 0, 2);
  }
  // Prompt 220: the view field is downedOperators — the short name this
  // once read never existed and the ?? [] hid it, so the 2D path drew NO
  // bodies from the day 14D shipped (view-contract class, wrong-name
  // variant; lint-pinned in view_contract.test.js).
  for (const d of view.downedOperators ?? []) push("operator_down", d.team, d, 0, 3);
  for (const a of [...(view.friendlyAssets ?? []), ...(view.visibleEnemies ?? [])]) {
    // visualKeyFor speaks manifest ("unit_tank"); sheets use builder keys.
    push(visualKeyFor(a).replace(/^unit_/, ""), a.team, a, a.heading, 4);
  }
  for (const d of view.drones ?? []) push("drone", d.team, d, 0, 5);
  return ops.sort((p, q) => p.z - q.z || p.y - q.y);
}

export function createSpriteRenderer({ canvas, base = "assets/sprites/", terrainColors = [], cellPx = 8 }) {
  const ctx = canvas.getContext("2d");
  const sheets = new Map(); // filename -> Image
  let manifest = null;

  async function load() {
    manifest = await (await fetch(`${base}manifest.json`)).json();
    await Promise.all(Object.keys(manifest.sheets).flatMap((key) => [0, 1].map((team) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { sheets.set(sheetName(key, team), img); resolve(); };
        img.onerror = () => resolve(); // a missing sheet degrades to nothing, not a crash
        img.src = `${base}${sheetName(key, team)}`;
      }))));
  }

  function draw(view, map) {
    if (!ctx) return;
    canvas.width = (map?.width ?? 128) * cellPx;
    canvas.height = (map?.height ?? 128) * cellPx;
    ctx.fillStyle = "#101018";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (map) {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          ctx.fillStyle = terrainColors[map.cells[y * map.width + x]] ?? "#333";
          ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
        }
      }
    }
    if (!manifest) return;
    const size = cellPx * 3; // sprite footprint on the minimap-scale canvas
    for (const op of buildDrawList(view)) {
      const img = sheets.get(sheetName(op.key, op.team));
      const frames = manifest.sheets[op.key]?.frames ?? 1;
      if (!img) continue;
      const r = frameRect(frames, op.brads);
      ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh,
        op.x * cellPx - size / 2, op.y * cellPx - size / 2, size, size);
    }
  }

  return { load, draw, sheets, tile: SPRITE_TILE };
}
