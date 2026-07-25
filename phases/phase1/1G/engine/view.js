// engine/view.js — fog-filtered view builder with HP/Status (1G)

export function buildView(state, operatorId) {
  const operator = state.operators.find(o => o.id === operatorId);
  if (!operator) return { error: 'not found' };

  return {
    tick: state.tick,
    operatorId: operator.id,
    team: operator.team,
    assets: state.assets.map(a => ({
      id: a.id,
      team: a.team,
      x: a.x,
      y: a.y,
      status: a.status,
      hp: a.hp,
      type: a.type
    })),
    sites: state.sites,
    mapCells: state.map.cells,
  };
}
