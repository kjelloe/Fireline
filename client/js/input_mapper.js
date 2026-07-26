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

function atCell(entity, cellX, cellY, radiusCells = 0) {
  const ex = Math.floor(entity.x / CELL_WORLD_UNITS);
  const ey = Math.floor(entity.y / CELL_WORLD_UNITS);
  return Math.abs(ex - cellX) <= radiusCells && Math.abs(ey - cellY) <= radiusCells;
}

// 11O (Q23): direct drive is not an FPS — clicks get a generous snap
// radius onto the nearest visible target near the cursor.
export const DIRECT_ASSIST_CELLS = 3;

// Click semantics (8G): own selectable asset → select; visible live enemy →
// fire; own wreck → tow; anywhere else → move. Priority in that order.
// 11O: in directMode, clicks are WEAPONS ONLY — drone or enemy near the
// cursor fires (with assist); anything else returns null (the wheel owns
// movement, so a stray click must never send the tank somewhere).
export function buildCommandForClick(view, cellX, cellY, opts = {}) {
  const { fireRadiusCells = 0, myOperatorId = null, canTow = true, directMode = false } = opts;
  if (directMode) {
    const assist = Math.max(fireRadiusCells, DIRECT_ASSIST_CELLS);
    const drone = (view?.drones ?? [])
      .filter((d) => d.team !== view?.team)
      .filter((d) => atCell(d, cellX, cellY, assist))
      .sort((a, b) => a.id - b.id)[0];
    if (drone) return { type: "fire_order", targetDroneId: drone.id };
    const target = enemyAtCell(view, cellX, cellY, assist);
    if (target) return { type: "fire_order", targetAssetId: target.id };
    return null;
  }

  const selectable = (view?.friendlyAssets ?? [])
    .filter((a) => a.state !== DISABLED && a.state !== SALVAGED)
    .filter((a) => a.operatorId === -1 || a.operatorId === myOperatorId)
    .filter((a) => a.operatorId !== myOperatorId) // clicking your own does nothing new
    .filter((a) => atCell(a, cellX, cellY))
    .sort((a, b) => a.id - b.id);
  if (selectable.length > 0) {
    return { type: "select_asset", assetId: selectable[0].id };
  }

  // 9G: drones hover above everything — an enemy drone under the click is
  // the target, even over an enemy asset on the same cell.
  const drone = (view?.drones ?? [])
    .filter((d) => d.team !== view?.team)
    .filter((d) => atCell(d, cellX, cellY, fireRadiusCells))
    .sort((a, b) => a.id - b.id)[0];
  if (drone) {
    return { type: "fire_order", targetDroneId: drone.id };
  }

  const target = enemyAtCell(view, cellX, cellY, fireRadiusCells);
  if (target) {
    return { type: "fire_order", targetAssetId: target.id };
  }

  const wrecks = !canTow ? [] : (view?.friendlyAssets ?? [])
    .filter((a) => (a.state === DISABLED || a.state === SALVAGED))
    .filter((a) => a.towedBy === -1 && a.recoverTimer === 0)
    .filter((a) => atCell(a, cellX, cellY))
    .sort((a, b) => a.id - b.id);
  if (wrecks.length > 0) {
    return { type: "tow_order", wreckAssetId: wrecks[0].id };
  }

  return { type: "move_order", targetCellX: cellX, targetCellY: cellY };
}

export function buildSelectCommand(assetId) {
  return { type: "select_asset", assetId };
}
