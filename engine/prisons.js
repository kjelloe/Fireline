// engine/prisons.js — the POW arc, slice 1 (specs/12, Q35/Q37/Q40).
//
// Each base holds a PRISON — a fenced compound inside the walls,
// behind the gate. A prison holds POWs: operators whose respawn seat
// is LOCKED (state OP_CAPTIVE) while they sit inside. Freeing them is
// a RAID: an enemy-of-the-jailer unit holds beside the prison for
// RAID_HOLD_TICKS and every POW walks out as a DOWNED operator — who
// must then be CARRIED home by a carrier (the whole rescue loop,
// reused; freed POWs cannot self-redeploy, or extraction would be
// pointless). Delivery unlocks the seat through the standing
// operator_delivered flow.
//
// Pre-placed POWs (Q40): each prison can START with N enemy operators
// — a symmetric, mirror-fair day-one objective. Defaults (flagged for
// owner review): N=2 per prison, the LAST TWO enemy AI regents.
//
// Own hashed array (the bridges/drops pattern — never sites: sites
// carry majority/supply semantics these compounds must not touch).

export const RAID_HOLD_TICKS = 100;   // 10 s beside the wire (Q37: 8-12 s)
export const RAID_RADIUS_CELLS = 2;   // "beside" the compound
export const PRISON_CAPACITY = 6;     // Q40: 4-6; the ceiling
export const RECOG_FREE_POW = 20;     // Q35 table
// Slice 2 (Q36): the scout's dark specialty.
export const CAPTURE_HOLD_TICKS = 30; // 3 s over the body — no drive-bys
export const RECOG_CAPTURE = 15;      // Q35 table
export const RECOG_POW_HOLD = 5;      // per held minute, to the captor
export const HOLD_PAY_TICKS = 600;    // one minute
// Review-2 anti-spiral: a freed POW abandoned at the wire goes back in.
export const RESECURE_TICKS = 600;    // 60 s unattended = re-secured
// Pre-placed captives: the LAST TWO AI regents of the enemy team
// (A regents are ops 16-19 + 24-27, B regents 20-23 + 28-31) —
// deterministic and exactly mirror-fair.
export const PREPLACED_POWS = Object.freeze({
  0: Object.freeze([30, 31]), // team A's prison holds B's last regents
  1: Object.freeze([26, 27]), // team B's prison holds A's last regents
});

// One prison per base, at a deterministic offset inside the walls
// (south-west of the spawns, clear of the approach road).
export function createPrisons(bases, powN = 0) {
  return bases
    .filter((b) => b.team === 0 || b.team === 1)
    .map((b) => ({
      team: b.team,
      cellX: b.x + 5,
      cellY: b.y + 15,
      // pows are {id, by}: by = the capturing operator (-1 for the
      // pre-placed), so the Q35 hold-pay knows whom to credit.
      pows: [...(PREPLACED_POWS[b.team] ?? [])].slice(0, powN | 0).map((id) => ({ id, by: -1 })),
      raidTicks: 0,
    }));
}

export function prisonFor(state, team) {
  return (state.prisons ?? []).find((p) => p.team === team);
}
