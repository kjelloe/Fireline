// engine/victory.js — victory conditions & game end (slice 3E).
// Pure verdict function; the reducer owns state transitions. Reasons are
// integer codes so they live in hashed state.

export const WIN_NONE = 0;
export const WIN_ELIMINATION = 1;
export const WIN_DOMINATION = 2;
export const WIN_TIME_LIMIT = 3;

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
export function checkVictory(state) {
  const aDown = teamEliminated(state, 0);
  const bDown = teamEliminated(state, 1);
  if (aDown && bDown) return { winner: -1, reason: WIN_ELIMINATION };
  if (aDown) return { winner: 1, reason: WIN_ELIMINATION };
  if (bDown) return { winner: 0, reason: WIN_ELIMINATION };

  if (state.dominationTeam !== -1 && state.dominationTicks >= DOMINATION_HOLD_TICKS) {
    return { winner: state.dominationTeam, reason: WIN_DOMINATION };
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
