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

export const MISSION_NONE = 0;
export const MISSION_CONVOY = 1;

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
  if ((rules?.mode ?? MISSION_NONE) !== MISSION_CONVOY) return null;
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
  return {
    kind: MISSION_CONVOY,
    attacker,
    convoyId: truck.id,
    gateCellX: attackerEast ? gate.x + gate.width + 1 : gate.x - 2,
    gateCellY: gate.y + ((gate.height / 2) | 0),
    timerTicks: rules.convoyTimer ?? CONVOY_TIMER_TICKS,
    restartTicks: 0,
  };
}
