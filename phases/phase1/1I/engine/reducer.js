// engine/reducer.js — deterministic reducer with combat and capture (1G/1I)

import { speedMultiplier } from './terrain.js';
import { resolveShot } from './combat.js';
import { ASSET_ACTIVE, ASSET_DISABLED } from './state.js';

export { createInitialState } from './state.js';

export function apply(state, command) {
  const next = {
    ...state,
    assets: state.assets.map(a => ({ ...a })),
    operators: (state.operators || []).map(o => ({ ...o })),
    sites: (state.sites || []).map(s => ({ ...s })),
    commands: [...(state.commands || [])],
  };

  if (command.type === 'FIRE') {
    const attacker = next.assets.find(a => a.id === command.assetId);
    const target = next.assets.find(a => a.id === command.targetId);

    if (attacker && target && attacker.status === ASSET_ACTIVE) {
      const dx = target.x - attacker.x;
      const dy = target.y - attacker.y;
      const distSq = dx * dx + dy * dy;

      const range = 5 * 256;
      if (distSq <= range * range && attacker.team !== target.team) {
        const result = resolveShot(attacker, target);
        target.hp = Math.max(0, (target.hp || 0) - result.hpDelta);
        if (target.hp === 0) {
          target.status = ASSET_DISABLED;
        }
      }
    }
  }

  if (command.type === 'CAPTURE') {
    const asset = next.assets.find(a => a.id === command.assetId);
    const site = next.sites.find(s => s.id === command.siteId);
    if (asset && site && asset.status === ASSET_ACTIVE) {
      const dx = asset.x - site.x;
      const dy = asset.y - site.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= 256 * 256) {
        site.team = asset.team;
      }
    }
  }

  if (command.type === 'tick') {
    next.tick = state.tick + 1;
    for (const asset of next.assets) {
      if (asset.status !== ASSET_ACTIVE) continue;
      if (asset.speed && state.map) {
        const cellX = Math.floor(asset.x / 256);
        const cellY = Math.floor(asset.y / 256);
        if (cellX >= 0 && cellX < state.map.width && cellY >= 0 && cellY < state.map.height) {
          const cellIdx = cellY * state.map.width + cellX;
          const terrain = state.map.cells[cellIdx];
          const mult = speedMultiplier(terrain);
          const step = ((asset.speed * mult) / 256) | 0;

          if (asset.targetX !== undefined && asset.targetY !== undefined) {
             const dx = asset.targetX - asset.x;
             const dy = asset.targetY - asset.y;
             const dist = Math.sqrt(dx * dx + dy * dy);
             if (dist > step && dist > 0) {
               asset.x = (asset.x + (dx / dist) * step) | 0;
               asset.y = (asset.y + (dy / dist) * step) | 0;
             } else {
               asset.x = asset.targetX; asset.y = asset.targetY;
               asset.targetX = undefined; asset.targetY = undefined;
             }
          }
        }
      }
    }
  }
  return next;
}
