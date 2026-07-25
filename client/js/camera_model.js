// client/js/camera_model.js — free camera state (slice 8G).
// Pure presentation math: pan, zoom, clamping, follow toggle, jump targets.

export function createCamera({ mapSize = 128, x = 64, y = 64, zoom = 18 } = {}) {
  const cam = {
    mapSize, x, y, zoom,
    follow: true,
    minZoom: 6,
    maxZoom: 64,
  };

  function clampPosition() {
    cam.x = Math.min(cam.mapSize, Math.max(0, cam.x));
    cam.y = Math.min(cam.mapSize, Math.max(0, cam.y));
  }

  return {
    get state() { return { x: cam.x, y: cam.y, zoom: cam.zoom, follow: cam.follow }; },

    pan(dx, dy) {
      cam.follow = false;
      cam.x += dx;
      cam.y += dy;
      clampPosition();
    },

    zoomBy(factor) {
      cam.zoom = Math.min(cam.maxZoom, Math.max(cam.minZoom, cam.zoom * factor));
    },

    jumpTo(cellX, cellY) {
      cam.follow = false;
      cam.x = cellX;
      cam.y = cellY;
      clampPosition();
    },

    followMode(on) {
      cam.follow = on;
    },

    // Follow target supplied per frame by the renderer when follow is on.
    trackIfFollowing(cellX, cellY) {
      if (!cam.follow) return;
      cam.x = cellX;
      cam.y = cellY;
      clampPosition();
    },
  };
}

// Keyboard pan mapping: returns {dx, dy} in cells or null.
const PAN_KEYS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
};

export function panForKey(key, cellsPerStep = 3) {
  const dir = PAN_KEYS[key];
  if (!dir) return null;
  return { dx: dir[0] * cellsPerStep, dy: dir[1] * cellsPerStep };
}
