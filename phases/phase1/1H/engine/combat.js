// engine/combat.js — combat resolution logic (1G)

export function resolveShot(attacker, target) {
  // Simple deterministic combat: 20 HP damage per hit
  // Returns delta to be applied to target HP
  return {
    hpDelta: 20,
    suppressed: true
  };
}
