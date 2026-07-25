// engine/view.js — fog-filtered view builder with LOS + supply flag (1J)

import { computeVisible } from './los.js';
import { ASSET_DISABLED } from './state.js';
import { inSupply } from './supply.js';

export function buildView(state, operatorId) {
  const operator = state.operators.find(o => o.id === operatorId);
  if (!operator) return { error: 'not found' };

  const visibleIds = computeVisible(state, operator.team);

  const assets = state.assets
    .filter(a => a.team === operator.team || visibleIds.has(a.id) || a.status === ASSET_DISABLED)
    .map(a => ({
      id: a.id,
      team: a.team,
      x: a.x,
      y: a.y,
      status: a.status,
      hp: a.hp,
      type: a.type,
      inSupply: a.team === operator.team ? inSupply(state, a) : undefined
    }));

  return {
    tick: state.tick,
    operatorId: operator.id,
    team: operator.team,
    assets: assets,
    sites: state.sites,
    mapCells: state.map.cells,
  };
}
