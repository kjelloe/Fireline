// engine/view.js — fog-filtered per-team view builder (1E contract, 1F mapCells,
// 1H LOS). Views are the only state representation that may cross the network.
// Enemy visibility is decided by engine/los.js; enemy records leak no
// hp/target/operator information.

export { FOG_RADIUS_CELLS } from "./los.js";
import { computeVisible } from "./los.js";

export function buildView(state, team) {
  const friendlyAssets = state.assets
    .filter((a) => a.team === team)
    .map((a) => ({
      id: a.id, type: a.type, team: a.team, state: a.state,
      x: a.x, y: a.y, targetX: a.targetX, targetY: a.targetY,
      hp: a.hp, operatorId: a.operatorId,
    }));

  const visible = computeVisible(state, team);
  const visibleEnemies = state.assets
    .filter((a) => visible.has(a.id))
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
