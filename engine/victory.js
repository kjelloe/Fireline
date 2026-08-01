// engine/victory.js — victory conditions & game end (slice 3E).
// Pure verdict function; the reducer owns state transitions. Reasons are
// integer codes so they live in hashed state.

import { MISSION_CONVOY, CONVOY_DELIVER_CELLS } from "./mission.js";
import { worldToCellFloor } from "../shared/fixedmath.js";

export const WIN_NONE = 0;
export const WIN_ELIMINATION = 1;
export const WIN_DOMINATION = 2;
export const WIN_TIME_LIMIT = 3;
export const WIN_STANDARD = 4; // 8C: the primary victory — flag captured
export const WIN_TICKETS = 5;  // 13H: the enemy pool bled dry (prompt-51 hybrid)
export const WIN_CONVOY_DELIVERED = 6; // mode: the convoy reached the gate
export const WIN_CONVOY_STOPPED = 7;   // mode: timer expired or hull salvaged
export const WIN_HEIST_TIMEOUT = 8;    // mode: the Asset never left the vault

// Prompt 136: total ticks B3 overtime may hold an empty pool open.
export const OVERTIME_CAP_TICKS = 600;

export const PHASE_RUNNING = 0;
export const PHASE_OVER = 1;

// Hold every relay for 30s (10Hz) to win by domination.
export const DOMINATION_HOLD_TICKS = 300;
// 30-minute war clock; highest score wins at the horn.
export const TIME_LIMIT_TICKS = 18000;

const WRECKED = new Set([2, 3]); // ASSET_DISABLED, ASSET_SALVAGED

function teamEliminated(state, team) {
  const assets = state.assets.filter((a) => a.team === team);
  if (assets.length === 0) return false; // a team not fielded cannot be eliminated
  return assets.every((a) => WRECKED.has(a.state));
}

// Returns null while the war continues, else {winner: 0|1|-1, reason}.
// Command Standard capture is checked FIRST — it is the primary condition;
// elimination, domination and the clock are secondary/fallback paths.
export function checkVictory(state) {
  // Asymmetric mode framework: a live mission REPLACES the standard
  // win paths (standards never spawn; tickets/domination cannot end a
  // mode war — its clock and objective are the whole story).
  // Elimination stays as the backstop for a genuinely dead war.
  // Q52 HEIST: the scored Asset IS the standard win (reason 4 keeps
  // its meaning); the clock hands it to the defenders; elimination
  // stays the backstop. Tickets/domination cannot end a mode war.
  if (state.mission?.kind === 2 /* MISSION_HEIST */) {
    const m = state.mission;
    const scored = state.standards.find((st) => st.status === 3 /* STD_SCORED */);
    if (scored) return { winner: m.attacker, reason: WIN_STANDARD };
    if (m.timerTicks <= 0) {
      return { winner: m.attacker === 0 ? 1 : 0, reason: WIN_HEIST_TIMEOUT };
    }
    const aDead = teamEliminated(state, 0);
    const bDead = teamEliminated(state, 1);
    if (aDead && bDead) return { winner: -1, reason: WIN_ELIMINATION };
    if (aDead) return { winner: 1, reason: WIN_ELIMINATION };
    if (bDead) return { winner: 0, reason: WIN_ELIMINATION };
    return null;
  }

  if (state.mission?.kind === MISSION_CONVOY) {
    const m = state.mission;
    const convoy = state.assets[m.convoyId];
    const salvaged = !convoy || convoy.state === 3 /* ASSET_SALVAGED */;
    if (salvaged) return { winner: m.attacker === 0 ? 1 : 0, reason: WIN_CONVOY_STOPPED };
    if (convoy.state !== 2 /* ASSET_DISABLED */) {
      const cx = worldToCellFloor(convoy.x);
      const cy = worldToCellFloor(convoy.y);
      if (Math.max(Math.abs(cx - m.gateCellX), Math.abs(cy - m.gateCellY)) <= CONVOY_DELIVER_CELLS) {
        return { winner: m.attacker, reason: WIN_CONVOY_DELIVERED };
      }
    }
    if (m.timerTicks <= 0) {
      return { winner: m.attacker === 0 ? 1 : 0, reason: WIN_CONVOY_STOPPED };
    }
    const aDead = teamEliminated(state, 0);
    const bDead = teamEliminated(state, 1);
    if (aDead && bDead) return { winner: -1, reason: WIN_ELIMINATION };
    if (aDead) return { winner: 1, reason: WIN_ELIMINATION };
    if (bDead) return { winner: 0, reason: WIN_ELIMINATION };
    return null;
  }

  const scored = state.standards.find((st) => st.status === 3 /* STD_SCORED */);
  if (scored) {
    return { winner: scored.team === 0 ? 1 : 0, reason: WIN_STANDARD };
  }

  const aDown = teamEliminated(state, 0);
  const bDown = teamEliminated(state, 1);
  if (aDown && bDown) return { winner: -1, reason: WIN_ELIMINATION };
  if (aDown) return { winner: 1, reason: WIN_ELIMINATION };
  if (bDown) return { winner: 0, reason: WIN_ELIMINATION };

  if (state.dominationTeam !== -1 && state.dominationTicks >= DOMINATION_HOLD_TICKS) {
    return { winner: state.dominationTeam, reason: WIN_DOMINATION };
  }

  // 13H hybrid ticket bleed (prompt-51 ruling): relay MAJORITY drains the
  // enemy pool; an empty pool loses the war. The horn stays as backstop.
  if (state.tickets) {
    const [ta, tb] = state.tickets;
    // B3 OVERTIME: an empty pool does not end the war while the losing
    // side still has a play LIVE — a capture in progress, or their hands
    // on a standard. A war decided mid-capture is a photo finish stolen
    // by a clock; this lets it resolve first. Pure function of state, so
    // it needs no new hashed field.
    const overtime = (team) => {
      if (state.rules?.overtime === false) return false;
      // Prompt 136: the photo-finish window is one minute, total. The
      // reducer counts held-open ticks in state.overtime; past the cap
      // an empty pool ends the war no matter what play is live.
      if ((state.overtime ?? 0) > (state.rules?.overtimeCapTicks ?? OVERTIME_CAP_TICKS)) return false;
      const capturing = (state.sites ?? []).some((s) => s.capturingTeam === team);
      const runLive = (state.standards ?? []).some((st) =>
        st.status === 1 /* CARRIED */ && st.team !== team) ||
        (state.standards ?? []).some((st) =>
          st.status === 2 /* DROPPED */ && st.team === team);
      return capturing || runLive;
    };
    const aOut = ta <= 0 && !overtime(0);
    const bOut = tb <= 0 && !overtime(1);
    if (aOut && bOut) return { winner: -1, reason: WIN_TICKETS };
    if (aOut) return { winner: 1, reason: WIN_TICKETS };
    if (bOut) return { winner: 0, reason: WIN_TICKETS };
  }

  if (state.tick >= TIME_LIMIT_TICKS) {
    const [a, b] = state.teamScores;
    return { winner: a > b ? 0 : b > a ? 1 : -1, reason: WIN_TIME_LIMIT };
  }
  return null;
}

// Which team owns every relay right now (-1 if none/contested/no sites).
export function dominatingTeam(state) {
  if (state.sites.length === 0) return -1;
  const owner = state.sites[0].owner;
  if (owner === -1) return -1;
  return state.sites.every((s) => s.owner === owner) ? owner : -1;
}
