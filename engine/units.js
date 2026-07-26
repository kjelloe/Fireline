// engine/units.js — unit roster and stats (slice 3A).
// Canonical stats live HERE (the engine performs no file I/O; data/units.json
// is a generated mirror for tooling/modding, pinned equal by milestone3a).
// Unknown types resolve to the tank chassis so pre-3A fixtures stay valid.

export const UNIT_TANK = 0;
export const UNIT_SCOUT = 1;
export const UNIT_ARTILLERY = 2;
export const UNIT_LOGISTICS = 3;
export const UNIT_CARRIER = 4;

export const UNIT_STATS = Object.freeze({
  [UNIT_TANK]: Object.freeze({
    id: UNIT_TANK, name: "tank",
    speed: 32, range: 1280, minRange: 0, hp: 100, damage: 20, indirect: false, reloadTicks: 15, canTow: false, canCarryStandard: false, capacity: 0,
  }),
  [UNIT_SCOUT]: Object.freeze({
    id: UNIT_SCOUT, name: "scout",
    speed: 56, range: 1024, minRange: 0, hp: 60, damage: 10, indirect: false, reloadTicks: 8, canTow: false, canCarryStandard: false, capacity: 0,
  }),
  [UNIT_ARTILLERY]: Object.freeze({
    id: UNIT_ARTILLERY, name: "artillery",
    speed: 16, range: 3072, minRange: 768, hp: 80, damage: 30, indirect: true, reloadTicks: 40, canTow: false, canCarryStandard: false, capacity: 0,
  }),
  // Spec roster middle path (playtest 2 decision): the Logistics Truck is the
  // ONLY chassis that tows — the rescue fantasy becomes a role, not a chore.
  [UNIT_LOGISTICS]: Object.freeze({
    id: UNIT_LOGISTICS, name: "logistics",
    speed: 40, range: 768, minRange: 0, hp: 80, damage: 5, indirect: false, reloadTicks: 20,
    canTow: true, canCarryStandard: false, capacity: 0,
  }),
  // Rescue Update 9A (rulings Q1/Q2): the Command Carrier is the ONLY chassis
  // that can take the enemy standard, and it will carry downed operators (9B).
  [UNIT_CARRIER]: Object.freeze({
    id: UNIT_CARRIER, name: "carrier",
    speed: 24, range: 768, minRange: 0, hp: 120, damage: 5, indirect: false, reloadTicks: 25,
    canTow: false, canCarryStandard: true, capacity: 2,
  }),
});

export function getUnitStats(type) {
  return UNIT_STATS[type] ?? UNIT_STATS[UNIT_TANK];
}
