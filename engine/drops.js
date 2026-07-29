// engine/drops.js — B6: the neutral supply drop (ruled, eval #B6).
//
// Mid-war, on a SEED-SCHEDULED tick, a supply drop activates on the
// map's exact mirror line (world x = W*256/2 — the one x that maps to
// itself under reflection, so neither side is closer by construction;
// the row is seeded, and the mirror is x-only so any row is neutral).
// First team to hold it EXCLUSIVELY for HOLD_TICKS wins the packet:
// tickets back into their pool, recognition to the crews on the spot.
// One shot, then it is spent.
//
// Deliberately NOT a site — a mid-war site would change the
// ticket-majority denominator and project supply/fog (the 13E bridge
// lesson: 24 call sites iterate .sites). Drops are their own hashed
// array, like bridges, and empty-inert until activation.

import { seedSfc32, sfc32Next } from "../shared/prng.js";

export const DROP_HOLD_TICKS = 100;      // 10 s of exclusive holding
export const DROP_RADIUS_CELLS = 3;      // the crate's contested ring
export const DROP_TICKET_PACKET = 15;    // ~5% of a pool — worth a fight
export const DROP_ACTIVATE_MIN = 3000;   // never before the lines form
export const DROP_ACTIVATE_SPAN = 6000;  // ...and lands by mid-war
export const DROP_ROW_MIN = 24;          // inside the contested band
export const DROP_ROW_SPAN = 80;

// One scheduled drop per war, derived purely from the map seed at
// state creation — replays and mirror runs see the identical schedule.
export function createDrops(mapSeed) {
  let s = seedSfc32((mapSeed ^ 0xd50b) >>> 0); // domain-separated from mapgen
  const a = sfc32Next(s); s = a.nextState;
  const b = sfc32Next(s);
  return [{
    id: 0,
    cellY: DROP_ROW_MIN + ((a.value >>> 0) % DROP_ROW_SPAN),
    activateTick: DROP_ACTIVATE_MIN + ((b.value >>> 0) % DROP_ACTIVATE_SPAN),
    holdTicks: 0,
    heldBy: -1,     // team currently alone in the ring
    securedBy: -1,  // -1 while live; the winning team once spent
  }];
}

export function dropActive(drop, tick) {
  return drop.securedBy === -1 && tick >= drop.activateTick;
}

// World-space centre of the drop: the exact mirror line, seeded row.
export function dropWorld(drop, mapWidth = 128) {
  return { x: (mapWidth * 256) >> 1, y: drop.cellY * 256 + 128 };
}
