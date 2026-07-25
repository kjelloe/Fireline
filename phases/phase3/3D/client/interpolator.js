// client/interpolator.js — 10Hz snapshot interpolator (2C)
// Smooths asset positions between server snapshots for 60fps rendering.
// Pure function: no DOM, no Three.js dependency — testable in Node.

export function createInterpolator() {
  let prevSnapshot = null;
  let nextSnapshot = null;
  let lastSnapshotTime = 0;
  const TICK_MS = 100; // 10Hz

  return {
    pushSnapshot(snapshot) {
      prevSnapshot = nextSnapshot;
      nextSnapshot = snapshot;
      lastSnapshotTime = Date.now();
    },

    getFrame(now = Date.now()) {
      if (!nextSnapshot) return null;
      if (!prevSnapshot) return nextSnapshot;

      const t = Math.min(1.0, (now - lastSnapshotTime) / TICK_MS);

      const assets = nextSnapshot.assets.map(next => {
        const prev = prevSnapshot.assets.find(a => a.id === next.id);
        if (!prev) return next;
        return {
          ...next,
          x: lerp(prev.x, next.x, t),
          y: lerp(prev.y, next.y, t),
        };
      });

      return { ...nextSnapshot, assets };
    }
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
