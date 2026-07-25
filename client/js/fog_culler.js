// client/js/fog_culler.js — client-side fog culling contract (slice 2E).
// Pure diffing, node-testable. The server's view is the sole visibility
// authority: the scene must add exactly what appeared, remove exactly what
// vanished, and never retain anything the newest view omits.

export function visibleEnemyIds(view) {
  return new Set((view?.visibleEnemies ?? []).map((e) => e.id));
}

// prevIds: Set<number> currently rendered enemy ids.
// view: newest server view. Returns arrays of ids.
export function diffVisibleEnemies(prevIds, view) {
  const nextIds = visibleEnemyIds(view);
  const added = [];
  const removed = [];
  const kept = [];
  for (const id of nextIds) {
    if (prevIds.has(id)) kept.push(id);
    else added.push(id);
  }
  for (const id of prevIds) {
    if (!nextIds.has(id)) removed.push(id);
  }
  added.sort((a, b) => a - b);
  removed.sort((a, b) => a - b);
  kept.sort((a, b) => a - b);
  return { added, removed, kept };
}
