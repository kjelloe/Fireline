// engine/mission.js — the asymmetric mode framework (v1) and its first
// mode: CONVOY ESCORT (specs/maps-asymmetric-gamemode*.md, Q32/prompt
// "go ahead with convoy").
//
// Framework shape: `state.mission` is null in every standard war and a
// hashed object when a mode is live (the bridges pattern — absent means
// the 1A fixture never notices). The mode comes in through session
// rules (`rules.mode`), so no new commands and no ws surface.
//
// CONVOY ESCORT: the attacker team escorts ONE high-value logistics
// truck from its own lines to the enemy base gate before the timer
// expires. The truck is an ordinary asset — towable, repairable,
// crewable — so the whole recovery loop IS the mode (the designer's
// "match doesn't end when it stops; it ends if it cannot be restarted
// in time"). Defenders win on timer expiry or an unrecoverable wreck.

import { cellToWorld, truncDivI32 } from "../shared/fixedmath.js";

export const MISSION_NONE = 0;
export const MISSION_CONVOY = 1;
export const MISSION_HEIST = 2; // Q52: the one-sided standard grab
// Heist clock: tighter than convoy — the vault run is a sprint with a
// getaway, not a siege. rules.heistTimer overrides.
export const HEIST_TIMER_TICKS = 9000;

// The convoy scores standing this close to the gate, operable.
export const CONVOY_DELIVER_CELLS = 3;
// Defenders get the convoy's position on this cadence (the designer's
// "radio pings" — deterministic, fog-independent, toTeam-scoped).
export const CONVOY_PING_TICKS = 300;
// Default mission clock (rules.convoyTimer overrides): 12.5 minutes.
// Tuned by probe, not by taste — see dev-log slice-convoy.
export const CONVOY_TIMER_TICKS = 9000;
// The RESTART law (the spec's own verb: "it ends if it cannot be
// restarted before the timer expires"): a friendly truck standing
// beside the convoy WRECK this long restarts it at half hull, in
// place. Mode-scoped — every other wreck still rides home on the hook
// (B1's recovery economy is untouched). Without this, each wreck cost
// a full tow-home round trip and the probe read 1/10 deliveries.
export const CONVOY_RESTART_TICKS = 80;

// Build the mission object at war start, AFTER assets exist. The convoy
// is the attacker's lowest-id logistics truck (canTow chassis); the
// gate is the DEFENDER base centre. Returns null when the rules ask for
// no mode (the standard war).
export function createMission(rules, assets, bases, getStats) {
  const mode = rules?.mode ?? MISSION_NONE;
  if (mode === MISSION_HEIST) {
    // Q52 HEIST: only the DEFENDER keeps a standard (the Asset in
    // their vault); the attacker's carrier must grab it and bring it
    // home before the clock dies. Scoring rides the 8B standard
    // machinery verbatim — this object is the clock and the sides.
    return {
      kind: MISSION_HEIST,
      attacker: rules.modeAttacker === 1 ? 1 : 0,
      timerTicks: rules.heistTimer ?? HEIST_TIMER_TICKS,
    };
  }
  if (mode !== MISSION_CONVOY) return null;
  const attacker = rules.modeAttacker === 1 ? 1 : 0;
  const truck = assets.find(
    (a) => a.team === attacker && getStats(a.type).canTow);
  const gate = bases.find((b) => b.team !== attacker);
  const home = bases.find((b) => b.team === attacker);
  if (!truck || !gate || !home) return null; // sandbox without trucks/bases: no mode
  // The extraction point sits at the compound's NEAR edge — the face
  // the attacker approaches — not the base centre. Centre-gating asked
  // the convoy to park inside the enemy spawn: probes stalled at 9-24
  // cells with the timer dead, every war. Geometry-derived (attacker
  // side decides the face), so it commutes with the mirror.
  const attackerEast = (home.x + ((home.width / 2) | 0)) > (gate.x + ((gate.width / 2) | 0));
  const gateCellX = attackerEast ? gate.x + gate.width + 1 : gate.x - 2;
  const gateCellY = gate.y + ((gate.height / 2) | 0);
  // Q82 RUNG 2 (owner ruling, prompt 184): SHORTEN THE ROUTE. The
  // ladder proved the defender-factory lever tops out around 24% — to
  // reach the ruled 30-40% band it would have to switch the defender's
  // rebuild off entirely, which destroys the mode's fiction. The real
  // problem is simpler: the truck cannot survive the distance. So the
  // convoy STARTS further forward. `convoyRouteScale` is the percentage
  // of the full run it must still cover (100 = the classic route).
  // Integer math with truncDiv, which is the mirror-symmetric rounding
  // (plain floor hands west-bound movers a free unit — the riverline
  // east-edge lesson), so a shortened route still commutes with the
  // mirror.
  const scale = rules.convoyRouteScale ?? 100;
  if (scale < 100) {
    const gx = cellToWorld(gateCellX);
    const gy = cellToWorld(gateCellY);
    truck.x += truncDivI32((gx - truck.x) * (100 - scale), 100);
    truck.y += truncDivI32((gy - truck.y) * (100 - scale), 100);
    truck.targetX = truck.x;
    truck.targetY = truck.y;
  }
  return {
    kind: MISSION_CONVOY,
    attacker,
    convoyId: truck.id,
    gateCellX,
    gateCellY,
    timerTicks: rules.convoyTimer ?? CONVOY_TIMER_TICKS,
    restartTicks: 0,
  };
}
