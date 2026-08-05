// engine/smoke.js — W4-6 (prompt 174): SMOKE SCREENS.
//
// WHY THIS EXISTS, measured: the mid-war ledger convicted artillery
// farming soft hulls at the centre as the war's dominant death pattern,
// and the game had NO counterplay to indirect fire except leaving. Smoke
// is the answer, and it covers exactly the fragile moments the game
// already stages — a carrier rescue, a convoy restart, a POW carried
// home on foot.
//
// DESIGN DEVIATION FROM THE PLAN, deliberate and recorded: the plan said
// "a sight line crossing a smoke cell stops there". This engine's LOS is
// not a raycast — computeVisible is Chebyshev-radius based — so line
// blocking would mean introducing a ray march into the one system the
// whole equivariance ladder was built to keep mirror-exact. Not worth
// it, and not necessary: CONCEALMENT gives the same tactical function.
// A hull standing in smoke is invisible beyond SMOKE_SEE_CELLS, and it
// can see no further itself. That is a pure per-cell property, so it
// commutes with the mirror for free and cannot disturb any tie law.
//
// Integer math only; every field below is hashed.

export const SMOKE_TICKS = 750;        // 30 s, the ruled duration
export const SMOKE_RADIUS_CELLS = 1;   // one deployment = a 3x3 patch
export const SMOKE_TEAM_CAP = 6;       // live patches per team
export const SMOKE_SEE_CELLS = 1;      // inside smoke: adjacent only, both ways
export const SMOKE_PER_TRUCK = 2;
export const SMOKE_PER_MORTAR = 2;

// Is this cell inside any live smoke patch? Smoke is BLIND to team: it
// conceals whoever stands in it, including the side that laid it. That
// is what makes it a screen and not a buff, and it is why a careless
// screen can hide the enemy from you too.
export function smokeAt(state, cellX, cellY) {
  for (const p of state.smokes ?? []) {
    if (Math.abs(p.cellX - cellX) <= SMOKE_RADIUS_CELLS &&
        Math.abs(p.cellY - cellY) <= SMOKE_RADIUS_CELLS) return p;
  }
  return null;
}

// Why this asset may not lay smoke here, or null if it may.
export function smokeRejection(state, asset, stats, cellX, cellY) {
  if ((stats.smoke ?? 0) === 0) return "this chassis carries no smoke";
  if ((asset.smokeLeft ?? 0) <= 0) return "smoke rack empty";
  if (cellX < 0 || cellY < 0 || cellX >= state.map.width || cellY >= state.map.height) {
    return "off the map";
  }
  const live = (state.smokes ?? []).filter((p) => p.team === asset.team).length;
  if (live >= SMOKE_TEAM_CAP) return "team smoke limit reached";
  // Stacking a patch on a patch wastes the rack and reads as a bug.
  for (const p of state.smokes ?? []) {
    if (p.cellX === cellX && p.cellY === cellY) return "smoke already here";
  }
  return null;
}

// One tick of ageing. Returns the ids of patches that just dispersed so
// the caller can emit events (the reducer owns the event stream).
export function stepSmoke(state) {
  const gone = [];
  for (const p of state.smokes ?? []) {
    p.ticks -= 1;
    if (p.ticks <= 0) gone.push(p.id);
  }
  if (gone.length > 0) {
    state.smokes = state.smokes.filter((p) => p.ticks > 0);
  }
  return gone;
}
