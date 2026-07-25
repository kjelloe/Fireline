// client/js/input_mapper.js — click → command mapping (slice 2D).
// Pure decision logic, node-testable. The client only proposes commands;
// the server's reducer decides every outcome.

export const CELL_WORLD_UNITS = 256;
export const CELL_MIN = 0;
export const CELL_MAX = 127;

const DISABLED = 2;
const SALVAGED = 3;

export function clampCell(v) {
  return Math.min(CELL_MAX, Math.max(CELL_MIN, Math.floor(v)));
}

// Scene coordinates use 1 unit = 1 cell (renderer convention).
export function scenePointToCell(sceneX, sceneZ) {
  return { cellX: clampCell(sceneX), cellY: clampCell(sceneZ) };
}

export function enemyAtCell(view, cellX, cellY, radiusCells = 0) {
  const hits = (view?.visibleEnemies ?? [])
    .filter((e) => e.state !== DISABLED && e.state !== SALVAGED)
    .filter((e) => {
      const ex = Math.floor(e.x / CELL_WORLD_UNITS);
      const ey = Math.floor(e.y / CELL_WORLD_UNITS);
      return Math.abs(ex - cellX) <= radiusCells && Math.abs(ey - cellY) <= radiusCells;
    })
    .sort((a, b) => a.id - b.id);
  return hits[0] ?? null;
}

// Click semantics: clicking a visible live enemy fires at it; anywhere else moves.
export function buildCommandForClick(view, cellX, cellY, { fireRadiusCells = 0 } = {}) {
  const target = enemyAtCell(view, cellX, cellY, fireRadiusCells);
  if (target) {
    return { type: "fire_order", targetAssetId: target.id };
  }
  return { type: "move_order", targetCellX: cellX, targetCellY: cellY };
}

export function buildSelectCommand(assetId) {
  return { type: "select_asset", assetId };
}
