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
  // TABLE EMPTY AGAIN (2026-08-05) — both convictions EXPIRED when the
  // two phase-lock bugs were fixed (b5b5a69 meeting-stop snapshots,
  // a81477c seeded lead team). Same-build a81477c pairs, n=300:
  //   sawtooth  54.8 / 54.4  (was 69.3/67.1 — aggregate 54.6, UNDER
  //             the 55 threshold; its tight chokes had amplified the
  //             contact-law bugs hardest, so the "unique pair" lean
  //             it was convicted for was mostly those bugs)
  //   riverline 47.0 / 51.0  (was 54.5/59.3 — aggregate 49.0, fair)
  // Neither map convicts now, so neither may carry an entry: a premium
  // without a measured lean is a lie about the map, and the briefing
  // disclosure would state that lie to every player. Q69's ruling
  // ACCEPTED a premium for a lean that has since been engineered away;
  // the mechanism stays, generated and battle-tested, for the next
  // map that actually earns one.
  // NOTE the premium is OUTCOME-NEUTRAL by construction: premiumPoints
  // touches operator Recognition only, never teamScores — so pulling
  // it cannot move a win rate and needs no battery.
});

// D+C ruling (prompt 154): MEASURED TICKET OFFSETS — the outcome-side
// sibling of the premium. On a map where the battery convicts the
// unique pair beyond the band, the DISADVANTAGED team starts with +N
// tickets. GENERATED like the premium (battery ladder tunes N until
// the map reads in band), DISCLOSED in the briefing, and retired
// map-by-map as real mechanism fixes land. rules.handicap === false
// disables (HANDICAP=0); rules.handicapTickets overrides N (the
// ladder's knob).
// profile -> { team: the team that RECEIVES the offset, tickets: N }.
// Seeds below are FIRST GUESSES pending the ladder verdict.
export const MAP_TICKET_OFFSET = Object.freeze({
  // TABLE EMPTY (2026-08-03) — twice-learned law: an offset is
  // "measured" ONLY against a SAME-BUILD baseline pair. Sawtooth:
  // offsets INERT (h20-60 moved ~1 pt). Riverline: the ladder was
  // read against a stale (pre-escort-wall) baseline — the current
  // build's mirror control reads 41.0% A with NO offset (the map's
  // own lean moved). A fresh same-build h0 pair decides whether any
  // offset (and which DIRECTION) is warranted. The mechanism stays,
  // battle-tested and disclosed, awaiting honest numbers.
});

export function ticketOffsetFor(mapProfile, rules) {
  if (rules?.handicap === false) return null;
  const entry = MAP_TICKET_OFFSET[mapProfile];
  if (!entry) return null;
  const n = rules?.handicapTickets ?? entry.tickets;
  return n > 0 ? { team: entry.team, tickets: n } : null;
}

export function premiumPoints(points, team, mapProfile) {
  if (MAP_PREMIUM[mapProfile] === team) {
    return ((points * PREMIUM_NUM) / PREMIUM_DEN) | 0;
  }
  return points;
}
