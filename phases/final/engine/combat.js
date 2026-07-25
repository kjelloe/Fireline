// engine/combat.js — combat resolution and indirect fire (3D)
import { getUnitStats } from './units.js';
import { inSupply } from './supply.js';

export function resolveShot(attacker, target) {
  const stats = getUnitStats(attacker.type);

  // Basic accuracy / RNG can be added here
  // For now, deterministic damage
  return {
    hpDelta: stats.damage || 20,
    hit: true
  };
}

export function canFire(state, attacker, target) {
  if (attacker.status !== 0 || target.status !== 0) return false;
  if (attacker.team === target.team) return false;
  if (!inSupply(state, attacker)) return false;

  const stats = getUnitStats(attacker.type);
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const distSq = dx * dx + dy * dy;
  const rangeSq = stats.range * stats.range;

  if (distSq > rangeSq) return false;

  // Indirect fire logic: ARTILLERY can shoot over forests/mountains
  // Ordinary units require direct LOS (to be fully implemented in LOS slice)
  // For 3D, we ensure Artillery range is respected.
  return true;
}
