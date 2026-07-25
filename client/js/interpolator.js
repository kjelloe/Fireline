// client/js/interpolator.js — snapshot interpolation (slice 2C).
// Pure presentation math, node-testable. Buffers 10Hz fog-filtered views and
// samples smooth positions a fixed delay behind the newest snapshot.
// Authority rule: the NEWEST view decides what exists — interpolation never
// resurrects entities the server has fogged out.

export function createInterpolator({ delayMs = 100, capacity = 30 } = {}) {
  const buffer = []; // { atMs, view }

  function bracket(targetMs) {
    let older = null;
    let newer = null;
    for (const entry of buffer) {
      if (entry.atMs <= targetMs) older = entry;
      else { newer = entry; break; }
    }
    return { older, newer };
  }

  function lerpEntities(oldList, newList, t) {
    const oldById = new Map((oldList ?? []).map((e) => [e.id, e]));
    return (newList ?? []).map((e) => {
      const prev = oldById.get(e.id);
      if (!prev) return { ...e };
      return {
        ...e,
        x: prev.x + (e.x - prev.x) * t,
        y: prev.y + (e.y - prev.y) * t,
      };
    });
  }

  return {
    push(view, atMs) {
      if (buffer.length && atMs < buffer.at(-1).atMs) return; // drop out-of-order
      buffer.push({ atMs, view });
      while (buffer.length > capacity) buffer.shift();
    },

    latest() {
      return buffer.at(-1)?.view ?? null;
    },

    // Returns a view-shaped object with interpolated entity positions,
    // or null when no snapshot has arrived yet.
    sample(nowMs) {
      if (buffer.length === 0) return null;
      const targetMs = nowMs - delayMs;
      const { older, newer } = bracket(targetMs);

      if (!newer) {
        const last = buffer.at(-1);
        return { ...last.view };
      }
      if (!older) {
        return { ...newer.view };
      }
      const span = newer.atMs - older.atMs;
      const t = span > 0 ? Math.min(1, Math.max(0, (targetMs - older.atMs) / span)) : 1;
      return {
        ...newer.view,
        friendlyAssets: lerpEntities(older.view.friendlyAssets, newer.view.friendlyAssets, t),
        visibleEnemies: lerpEntities(older.view.visibleEnemies, newer.view.visibleEnemies, t),
      };
    },
  };
}
