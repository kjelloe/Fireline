// client/js/minimap_model.js — fog-aware minimap data (slice 8F).
// Pure projection of a server view into drawable primitives. The minimap can
// only ever show what the view already contains — no extra knowledge.

const CELL = 256;

export const DOT_FRIENDLY = "friendly";
export const DOT_ENEMY = "enemy";
export const DOT_WRECK = "wreck";

// Returns { mapSize, zones, relays, standards, dots, viewport } — all in cell
// coordinates for a square minimap canvas to scale.
export function buildMinimapModel(view, mapSize, camera = null) {
  const zones = (view?.bases ?? []).map((b) => ({
    team: b.team, x: b.x, y: b.y, width: b.width, height: b.height,
  }));

  const relays = (view?.sites ?? []).map((s) => ({
    x: s.cellX, y: s.cellY, owner: s.owner,
  }));

  // Standards are always view-visible (8A fog exception): show status too.
  const standards = (view?.standards ?? []).map((st) => ({
    team: st.team, x: st.x / CELL, y: st.y / CELL, status: st.status,
  }));

  const dots = [];
  for (const a of view?.friendlyAssets ?? []) {
    dots.push({
      kind: a.state === 2 || a.state === 3 ? DOT_WRECK : DOT_FRIENDLY,
      x: a.x / CELL, y: a.y / CELL,
      mine: a.operatorId === view?.myOperatorId,
    });
  }
  for (const e of view?.visibleEnemies ?? []) {
    dots.push({
      kind: e.state === 2 || e.state === 3 ? DOT_WRECK : DOT_ENEMY,
      x: e.x / CELL, y: e.y / CELL,
      mine: false,
    });
  }

  const viewport = camera
    ? { x: camera.x - camera.halfW, y: camera.y - camera.halfH,
        width: camera.halfW * 2, height: camera.halfH * 2 }
    : null;

  return { mapSize, zones, relays, standards, dots, viewport };
}

// Map a click on the minimap canvas (0..canvasSize) to a battlefield cell.
export function minimapClickToCell(px, py, canvasSize, mapSize) {
  const scale = mapSize / canvasSize;
  const clamp = (v) => Math.min(mapSize - 1, Math.max(0, Math.floor(v * scale)));
  return { cellX: clamp(px), cellY: clamp(py) };
}
