// engine/caltrops.js — Q45/Q50 chase-shapers (designer table, specs/12).
// DISTINCT from mines by design: caltrops delay pursuit, they never
// punish — slow-only, no damage, short-lived, cleared by any truck.
// Light units (scout, bike) carry them; the drop refuses stacking.

export const CALTROP_TICKS = 450;   // 45 s — middle of the ruled 30-60 band
export const CALTROP_SLOW_NUM = 7;  // 30% slow — middle of the ruled 25-40%
export const CALTROP_SLOW_DEN = 10;

// A live caltrop patch on this cell (any team unless filtered).
export function caltropAt(state, cellX, cellY, team = -1) {
  return (state.caltrops ?? []).find((c) =>
    c.cellX === cellX && c.cellY === cellY &&
    (team === -1 || c.team === team)) ?? null;
}

// A live ENEMY patch under this unit's tracks?
export function enemyCaltropAt(state, cellX, cellY, team) {
  return (state.caltrops ?? []).find((c) =>
    c.cellX === cellX && c.cellY === cellY && c.team !== team) ?? null;
}
