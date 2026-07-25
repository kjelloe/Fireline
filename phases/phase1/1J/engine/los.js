// engine/los.js — line-of-sight and visibility logic (1H/1I)

import { ASSET_SUPPRESSED } from './state.js';

export function computeVisible(state, team) {
  const visibleAssetIds = new Set();
  const ownAssets = state.assets.filter(a => a.team === team);
  const ownSites = (state.sites || []).filter(s => s.team === team);

  const observers = [
    ...ownAssets.map(a => ({
      x: a.x,
      y: a.y,
      radiusCells: (a.status === ASSET_SUPPRESSED) ? 3 : 6
    })),
    ...ownSites.map(s => ({
      x: s.x,
      y: s.y,
      radiusCells: 8
    }))
  ];

  for (const obs of observers) {
    const radiusSq = (obs.radiusCells * 256) * (obs.radiusCells * 256);
    for (const target of state.assets) {
      if (visibleAssetIds.has(target.id)) continue;
      const dx = target.x - obs.x;
      const dy = target.y - obs.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radiusSq) {
        visibleAssetIds.add(target.id);
      }
    }
  }

  return visibleAssetIds;
}
