// engine/combat.js — deterministic combat resolution (slice 1G, stats 3A).
// Pure functions only: the reducer decides when to call and how to mutate.
// Damage/range come from the attacker's unit stats (tank pins the original
// 1G values: 20 hp per shot, 1280-unit range). Integer math throughout;
// squared distances stay well inside exact double range for 128x128 maps.

import { getUnitStats } from "./units.js";

export const DEFAULT_RULES = Object.freeze({
  damage: 20,
  range: 1280,
});

// Ticks of degraded sensor radius after taking a hit (1H). 30 ticks = 3s at 10Hz.
export const SUPPRESSION_TICKS = 30;

export function resolveShot(attacker, target) {
  return {
    hpDelta: getUnitStats(attacker.type).damage,
    suppressed: true,
  };
}

export function inFireRange(attacker, target) {
  const stats = getUnitStats(attacker.type);
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const distSq = dx * dx + dy * dy;
  if (distSq > stats.range * stats.range) return false;
  if (stats.minRange > 0 && distSq < stats.minRange * stats.minRange) return false;
  return true;
}
