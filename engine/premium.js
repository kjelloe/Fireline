// engine/premium.js — the underdog premium (prompts 58/68, GO ruling
// 2026-07-31): harder challenge, more reward. When a map measurably
// disadvantages one team, that team's Recognition earns a 25% premium
// — disclosed, sweep-derived, never hand-tuned.
//
// THE TABLE IS GENERATED, not authored: `node tools/gen_premium.mjs
// <normal.csv> <mirror.csv> <profile>` reads a mirrored battery pair
// and convicts only a TEAM-linked lean past the threshold (an
// aggregate the fairness doctrine would also convict). As of
// 2026-07-31 every live map measures INSIDE the band (frontier 52.9%,
// blackwood 49.4%, riverline 49.6% aggregate A), so the table is
// EMPTY and the mechanism is dormant — which is the honest state: a
// premium that exists without a measured lean is a lie about the map.
//
// Integer math only: 25% premium = points * 5 / 4, floored.

export const PREMIUM_THRESHOLD_PCT = 55; // aggregate lean that convicts
export const PREMIUM_NUM = 5;
export const PREMIUM_DEN = 4;

// profile -> the DISADVANTAGED team (0 or 1). Absent = fair = no premium.
export const MAP_PREMIUM = Object.freeze({
  // (empty by measurement, 2026-07-31 — see header)
});

export function premiumPoints(points, team, mapProfile) {
  if (MAP_PREMIUM[mapProfile] === team) {
    return ((points * PREMIUM_NUM) / PREMIUM_DEN) | 0;
  }
  return points;
}
