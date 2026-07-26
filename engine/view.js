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
      ammo: a.ammo, fuel: a.fuel,
      towedBy: a.towedBy, recoverTimer: a.recoverTimer,
      reloadTimer: a.reloadTimer,
      heading: a.heading,
    }));

  const visible = computeVisible(state, team);
  const visibleEnemies = state.assets
    .filter((a) => visible.has(a.id))
    .map((a) => ({ id: a.id, type: a.type, team: a.team, state: a.state, x: a.x, y: a.y, heading: a.heading }));

  // Relay infrastructure and base zones are public knowledge.
  const sites = state.sites.map((s) => ({
    id: s.id, type: s.type, owner: s.owner, cellX: s.cellX, cellY: s.cellY,
  }));
  const bases = state.bases.map((b) => ({ ...b }));
  // 9B: downed operators are visible to their OWN team only (enemies cannot
  // see or target them — follow-up ruling 1).
  const downedOperators = state.downed
    .filter((d) => d.team === team)
    .map((d) => ({ ...d }));
  // 8A: Command Standards are a deliberate fog exception — both teams always
  // know both standards' position and status. The stolen flag IS the drama.
  const standards = state.standards.map((st) => ({ ...st }));

  return {
    tick: state.tick,
    team,
    phase: state.phase,
    winner: state.winner,
    teamScores: [...state.teamScores],
    events: state.events,
    mapCells: state.map.cells,
    friendlyAssets,
    visibleEnemies,
    sites,
    bases,
    standards,
    downedOperators,
  };
}
