// client/js/ghosts_model.js — Slice 13E: fog ghosts (spec 02 §7). When a
// spotted enemy slips back into the fog, its LAST-SEEN position lingers
// as a fading ghost for a few seconds. Strictly presentation of
// legitimately known information: ghosts are born only from enemies the
// view actually delivered, and nothing here touches the network. Pure
// model — time arrives as a parameter.

export const GHOST_TTL_MS = 10000;

// One step: reconcile the ghost list against the current view.
// - a visible enemy has no ghost (and clears any stale one);
// - an enemy that VANISHED this step leaves a ghost at its last pose;
// - ghosts expire after GHOST_TTL_MS.
export function updateGhosts(ghosts, view, nowMs) {
  const visible = new Map();
  for (const e of view?.visibleEnemies ?? []) visible.set(e.id, e);

  const next = [];
  const ghosted = new Set();
  for (const g of ghosts) {
    if (visible.has(g.id)) continue;               // it's back — no ghost
    if (nowMs - g.lastSeenMs >= GHOST_TTL_MS) continue; // memory fades
    next.push(g);
    ghosted.add(g.id);
  }
  // Remember every currently visible enemy's pose so its ghost can be
  // born the moment it vanishes.
  for (const e of visible.values()) {
    next.push({
      id: e.id, type: e.type, team: e.team,
      x: e.x, y: e.y, heading: e.heading,
      lastSeenMs: nowMs, visible: true,
    });
  }
  // Ghosts whose enemy is STILL visible were skipped above; mark the
  // rest as true ghosts (visible flag off, lastSeenMs frozen).
  return next.map((g) => visible.has(g.id)
    ? g
    : { ...g, visible: false });
}

// 0..1 remaining presence for rendering (1 = just lost, 0 = gone).
export function ghostOpacity(ghost, nowMs) {
  if (ghost.visible) return 0; // the real mesh is on screen instead
  return Math.max(0, 1 - (nowMs - ghost.lastSeenMs) / GHOST_TTL_MS);
}
