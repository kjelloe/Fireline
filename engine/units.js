// engine/units.js — unit roster and stats (slice 3A).
// Canonical stats live HERE (the engine performs no file I/O; data/units.json
// is a generated mirror for tooling/modding, pinned equal by milestone3a).
// Unknown types resolve to the tank chassis so pre-3A fixtures stay valid.

export const UNIT_TANK = 0;
export const UNIT_SCOUT = 1;
export const UNIT_ARTILLERY = 2;
export const UNIT_LOGISTICS = 3;
export const UNIT_CARRIER = 4;
export const UNIT_BIKE = 5;    // 11R: scout bike
export const UNIT_MORTAR = 6;  // 11S: mortar carrier
export const UNIT_SENTINEL = 7; // 12B: Directorate unique

export const UNIT_STATS = Object.freeze({
  [UNIT_TANK]: Object.freeze({
    id: UNIT_TANK, name: "tank",
    speed: 32, range: 1280, minRange: 0, hp: 100, damage: 20, indirect: false, reloadTicks: 15, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 8,
    canMine: true, canClearMines: false, // 9E: the Assault chassis lays mines
    heavy: true, // 11N: too wide for woodland paths — crosses at rough speed
    canCapture: true, siege: false, // 11R
    deployable: false, // 12B
  }),
  [UNIT_SCOUT]: Object.freeze({
    id: UNIT_SCOUT, name: "scout",
    speed: 56, range: 1024, minRange: 0, hp: 60, damage: 10, indirect: false, reloadTicks: 8, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 14,
    canMine: false, canClearMines: false, // 9E: scouts DETECT mines (los pass)
    heavy: false, // 11N: paths are a scout's home ground
    canCapture: true, siege: false, // 11R
    deployable: false, // 12B
  }),
  [UNIT_ARTILLERY]: Object.freeze({
    id: UNIT_ARTILLERY, name: "artillery",
    // Q4 retune (prompt 16): ~6 s per half turn — siege guns swing SLOWLY.
    speed: 16, range: 3072, minRange: 768, hp: 80, damage: 30, indirect: true, reloadTicks: 40, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 2,
    canMine: false, canClearMines: false,
    heavy: false, // 11N
    canCapture: true, siege: true, // 11R: ONLY artillery breaches sites (Q9)
    deployable: false, // 12B
  }),
  // Spec roster middle path (playtest 2 decision): the Logistics Truck is the
  // ONLY chassis that tows — the rescue fantasy becomes a role, not a chore.
  [UNIT_LOGISTICS]: Object.freeze({
    id: UNIT_LOGISTICS, name: "logistics",
    speed: 40, range: 768, minRange: 0, hp: 80, damage: 5, indirect: false, reloadTicks: 20,
    canTow: true, canCarryStandard: false, capacity: 0, turnRate: 10,
    canMine: false, canClearMines: true, // 9E: trucks clear marked mines
    heavy: false, // 11N
    canCapture: true, siege: false, // 11R
    deployable: false, // 12B
  }),
  // Rescue Update 9A (rulings Q1/Q2): the Command Carrier is the ONLY chassis
  // that can take the enemy standard, and it will carry downed operators (9B).
  [UNIT_CARRIER]: Object.freeze({
    id: UNIT_CARRIER, name: "carrier",
    speed: 24, range: 768, minRange: 0, hp: 120, damage: 5, indirect: false, reloadTicks: 25,
    canTow: false, canCarryStandard: true, capacity: 2, turnRate: 6,
    canMine: false, canClearMines: false,
    heavy: false, // 11N
    canCapture: true, siege: false, // 11R
    deployable: false, // 12B
  }),
  // 11R (prompt 22): the Scout Bike — a courier that outruns everything,
  // dies to anything, and can neither capture nor contest a relay. It
  // SEES the war; it cannot HOLD it.
  [UNIT_BIKE]: Object.freeze({
    id: UNIT_BIKE, name: "bike",
    speed: 72, range: 768, minRange: 0, hp: 30, damage: 5, indirect: false, reloadTicks: 10,
    canTow: false, canCarryStandard: false, capacity: 0, turnRate: 20,
    canMine: false, canClearMines: false,
    heavy: false,
    canCapture: false, siege: false,
    deployable: false, // 12B
  }),
  // 12B (prompt 29): the Directorate Sentinel — Deploy Hardpoint. Mobile:
  // a crawling, lightly-armed hull. Deployed: an immobile hardpoint with
  // artillery-class DIRECT reach. fortify · contain · stabilize.
  [UNIT_SENTINEL]: Object.freeze({
    id: UNIT_SENTINEL, name: "sentinel",
    speed: 12, range: 1024, minRange: 0, hp: 150, damage: 8, indirect: false, reloadTicks: 20,
    canTow: false, canCarryStandard: false, capacity: 0, turnRate: 4,
    canMine: false, canClearMines: false,
    heavy: true,
    canCapture: true, siege: false,
    deployable: true,
    deployedRange: 2048, deployedDamage: 25, deployedReloadTicks: 20,
  }),
  // 11S (prompt 22): the Mortar Carrier — artillery's little brother that
  // keeps up with a push. Indirect fire on the move-and-stop rhythm:
  // shorter reach and lighter shells than the siege gun, but nearly twice
  // the mobility and a fast tube. NOT a siege piece (Q9: only artillery
  // breaches infrastructure).
  [UNIT_MORTAR]: Object.freeze({
    id: UNIT_MORTAR, name: "mortar",
    speed: 28, range: 1792, minRange: 512, hp: 60, damage: 15, indirect: true, reloadTicks: 25,
    canTow: false, canCarryStandard: false, capacity: 0, turnRate: 12,
    canMine: false, canClearMines: false,
    heavy: false,
    canCapture: true, siege: false,
    deployable: false, // 12B
  }),
});

export function getUnitStats(type) {
  return UNIT_STATS[type] ?? UNIT_STATS[UNIT_TANK];
}

// 12B: combat numbers depend on the hardpoint state. An ACTIVE hardpoint
// (deployed, transition finished) fights with its deployed profile;
// everything else uses the base chassis numbers.
export function effectiveCombat(asset) {
  const stats = getUnitStats(asset.type);
  if (stats.deployable && asset.deployed === 1 && (asset.deployTimer ?? 0) === 0) {
    return {
      range: stats.deployedRange, minRange: stats.minRange,
      damage: stats.deployedDamage, reloadTicks: stats.deployedReloadTicks,
    };
  }
  return {
    range: stats.range, minRange: stats.minRange,
    damage: stats.damage, reloadTicks: stats.reloadTicks,
  };
}
