// engine/combat.js — deterministic combat resolution (slice 1G).
// Pure functions only: the reducer decides when to call and how to mutate.
// Damage and range are pinned by milestone1g tests: 20 hp per shot, 1280
// fixed-unit range (5 cells). Integer math throughout; squared distances
// stay well inside exact double range for 128x128 maps.

export const DEFAULT_RULES = Object.freeze({
  damage: 20,
  range: 1280,
});

export function resolveShot(attacker, target, rules = DEFAULT_RULES) {
  return {
    hpDelta: rules.damage,
    suppressed: true,
  };
}

export function inFireRange(attacker, target, rules = DEFAULT_RULES) {
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  return dx * dx + dy * dy <= rules.range * rules.range;
}
