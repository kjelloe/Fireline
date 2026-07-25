// engine/reducer.js — deterministic reducer with terrain speed (1F)

import { speedMultiplier } from './terrain.js';
import { ASSET_ACTIVE } from './state.js';

export function createInitialState(seed, map) {
  return {
    seed: seed >>> 0,
    tick: 0,
    map,
    assets: [],
    operators: [],
    nextAssetId: 0,
    nextOperatorId: 0,
    sites: [],
    commands: [],
  };
}

export function apply(state, command) {
  // Shallow copy + deep copy of mutable arrays
  const next = {
    ...state,
    assets: state.assets.map(a => ({ ...a })),
    operators: state.operators.map(o => ({ ...o })),
    sites: state.sites.map(s => ({ ...s })),
    commands: [...state.commands],
  };

  if (command.type === 'tick') {
    next.tick = state.tick + 1;

    for (const asset of next.assets) {
      if (asset.status !== ASSET_ACTIVE) continue;
      if (!asset.speed) continue;

      const cellX = Math.floor(asset.x / 256);
      const cellY = Math.floor(asset.y / 256);
      if (cellX < 0 || cellX >= state.map.width || cellY < 0 || cellY >= state.map.height) {
        continue;
      }

      const cellIdx = cellY * state.map.width + cellX;
      const terrain = state.map.cells[cellIdx];
      const mult = speedMultiplier(terrain);
      const step = ((asset.speed * mult) / 256) | 0;

      if (asset.targetX !== undefined && asset.targetY !== undefined) {
        const dx = asset.targetX - asset.x;
        const dy = asset.targetY - asset.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > step) {
          const nx = dx / dist;
          const ny = dy / dist;
          asset.x = (asset.x + nx * step) | 0;
          asset.y = (asset.y + ny * step) | 0;
        } else {
          asset.x = asset.targetX;
          asset.y = asset.targetY;
          asset.targetX = undefined;
          asset.targetY = undefined;
        }
      } else {
        // Default: move right if no target
        asset.x = (asset.x + step) | 0;
      }
    }
  }

  return next;
}
