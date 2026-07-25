// engine/view.js — fog-filtered view builder with mapCells (1F)

export function buildView(state, operatorId) {
  const operator = state.operators.find(o => o.id === operatorId);
  if (!operator) {
    return {
      error: 'operator not found',
      tick: state.tick,
      mapCells: new Uint8Array(0),
      assets: [],
      sites: [],
    };
  }

  // 1F: no fog masking yet; all assets visible
  const visibleAssets = state.assets.map(a => ({
    id: a.id,
    team: a.team,
    x: a.x,
    y: a.y,
    status: a.status,
    type: a.type,
    hp: a.hp,
  }));

  return {
    tick: state.tick,
    operatorId: operator.id,
    team: operator.team,
    assets: visibleAssets,
    sites: state.sites,
    mapCells: state.map.cells,
  };
}
