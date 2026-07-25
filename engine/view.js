// engine/view.js — fog-filtered per-team view builder (1E contract + 1F mapCells).
// Views are the only state representation that may cross the network. Enemy
// assets appear only within FOG_RADIUS_CELLS (Chebyshev) of a living friendly
// asset, and leak no hp/target information.

import { ASSET_DISABLED, ASSET_SALVAGED } from "./state.js";
import { worldToCellFloor, absI32 } from "../shared/fixedmath.js";

export const FOG_RADIUS_CELLS = 12;

function chebyshevCells(a, b) {
  const dx = absI32(worldToCellFloor(a.x) - worldToCellFloor(b.x));
  const dy = absI32(worldToCellFloor(a.y) - worldToCellFloor(b.y));
  return dx > dy ? dx : dy;
}

export function buildView(state, team) {
  const friendly = state.assets.filter((a) => a.team === team);
  const sensors = friendly.filter(
    (a) => a.state !== ASSET_DISABLED && a.state !== ASSET_SALVAGED
  );

  const friendlyAssets = friendly.map((a) => ({
    id: a.id, type: a.type, team: a.team, state: a.state,
    x: a.x, y: a.y, targetX: a.targetX, targetY: a.targetY,
    hp: a.hp, operatorId: a.operatorId,
  }));

  const visibleEnemies = state.assets
    .filter((a) => a.team !== team && a.team !== -1)
    .filter((a) => sensors.some((s) => chebyshevCells(s, a) <= FOG_RADIUS_CELLS))
    .map((a) => ({ id: a.id, type: a.type, team: a.team, state: a.state, x: a.x, y: a.y }));

  return {
    tick: state.tick,
    team,
    events: state.events,
    mapCells: state.map.cells,
    friendlyAssets,
    visibleEnemies,
  };
}
