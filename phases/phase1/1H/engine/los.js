// engine/los.js — line-of-sight and visibility logic (1H)

import { ASSET_SUPPRESSED, ASSET_DISABLED } from './state.js';

export function computeVisible(state, team) {
  const visibleAssetIds = new Set();
  const ownAssets = state.assets.filter(a => a.team === team);

  // Each own asset provides a visibility radius
  for (const observer of ownAssets) {
    // Normal radius is 6 cells, suppressed is 3
    const radiusCells = (observer.status === ASSET_SUPPRESSED) ? 3 : 6;
    const radiusSq = (radiusCells * 256) * (radiusCells * 256);

    for (const target of state.assets) {
      if (visibleAssetIds.has(target.id)) continue;

      // Wrecks/Disabled are always visible if they've been spotted or are on the map?
      // For 1H, let's stick to distance-based fog.
      const dx = target.x - observer.x;
      const dy = target.y - observer.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= radiusSq) {
        visibleAssetIds.add(target.id);
      }
    }
  }

  return visibleAssetIds;
}
