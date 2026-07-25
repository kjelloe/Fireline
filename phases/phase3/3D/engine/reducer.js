// engine/reducer.js — deterministic reducer with combat, capture, supply (1J)

import { speedMultiplier } from './terrain.js';
import { resolveShot, canFire } from './combat.js';
import { inSupply } from './supply.js';
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

  next.commands.push(command);

    if (command.type === 'JOIN_INTERNAL') {
    const existing = next.operators.find(o => o.id === command.opId);
    if (!existing) {
      next.operators.push({ id: command.opId, team: command.team });
    }
  }

    if (command.type === 'FIRE') {
    const attacker = next.assets.find(a => a.id === command.assetId);
    const target = next.assets.find(a => a.id === command.targetId);

    if (attacker && target && canFire(next, attacker, target)) {
      const result = resolveShot(attacker, target);
      target.hp = Math.max(0, (target.hp || 0) - result.hpDelta);
      if (target.hp === 0) {
        target.status = 2; // ASSET_DISABLED
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

      const supplied = inSupply(next, asset);
      const supplyMult = supplied ? 1.0 : 0.5;

      if (asset.speed && state.map) {
        const cellX = Math.floor(asset.x / 256);
        const cellY = Math.floor(asset.y / 256);
        if (cellX >= 0 && cellX < state.map.width && cellY >= 0 && cellY < state.map.height) {
          const cellIdx = cellY * state.map.width + cellX;
          const terrain = state.map.cells[cellIdx];
          const mult = speedMultiplier(terrain) * supplyMult;
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

      // Attrition: every 10 ticks, out-of-supply assets lose 5 HP
      if (!supplied && next.tick % 10 === 0) {
        asset.hp = Math.max(0, (asset.hp || 0) - 5);
        if (asset.hp === 0) asset.status = ASSET_DISABLED;
      }
    }
  }
  return next;
}
