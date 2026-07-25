// server/ai_regent.js — AI Regency (3C)
// When a player disconnects, the Regent issues commands on their behalf.
// Pure function: (state, opId) -> command | null
// No I/O, no clocks. Deterministic given state.

import { getUnitStats } from '../engine/units.js';

const CELL = 256; // fixed-point units per cell

// Find the nearest enemy asset to a given asset
function nearestEnemy(state, asset) {
  let best = null;
  let bestDist = Infinity;
  for (const a of state.assets) {
    if (a.team === asset.team || a.status !== 0) continue;
    const dx = a.x - asset.x;
    const dy = a.y - asset.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = a; }
  }
  return best;
}

// Find the nearest uncaptured or enemy-held base
function nearestObjective(state, asset) {
  let best = null;
  let bestDist = Infinity;
  for (const s of (state.sites || [])) {
    if (s.team === asset.team) continue;
    const dx = s.x - asset.x;
    const dy = s.y - asset.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}

// Issue one command per asset owned by opId
export function regentCommands(state, opId) {
  const op = (state.operators || []).find(o => o.id === opId);
  if (!op) return [];

  const myAssets = state.assets.filter(a => a.team === op.team && a.status === 0);
  const commands = [];

  for (const asset of myAssets) {
    const stats = getUnitStats(asset.type);
    const rangeSq = stats.range * stats.range;

    // 1. If an enemy is in range, fire
    const enemy = nearestEnemy(state, asset);
    if (enemy) {
      const dx = enemy.x - asset.x;
      const dy = enemy.y - asset.y;
      if (dx * dx + dy * dy <= rangeSq) {
        commands.push({ type: 'FIRE', opId, assetId: asset.id, targetId: enemy.id });
        continue;
      }
    }

    // 2. Move toward nearest objective (base), else toward nearest enemy
    const obj = nearestObjective(state, asset) || enemy;
    if (obj) {
      commands.push({ type: 'MOVE', opId, assetId: asset.id, target: { x: obj.x, y: obj.y } });
    }
  }

  return commands;
}
