// client/accessibility.js — Accessibility Suite (7B)
// Pure functions: no DOM, no I/O, no hidden state.
// All stateful objects are created via factory functions and passed by the caller.

// ── Colorblind simulation matrices (3×3 RGB, row-major) ──────────────────────
// Source: Machado et al. (2009) — linearised approximations.
// Each matrix maps [R, G, B] -> [R', G', B'] in [0, 255] space.
export const COLORBLIND_MATRICES = Object.freeze({
  protanopia: [
    0.567, 0.433, 0.000,
    0.558, 0.442, 0.000,
    0.000, 0.242, 0.758
  ],
  deuteranopia: [
    0.625, 0.375, 0.000,
    0.700, 0.300, 0.000,
    0.000, 0.300, 0.700
  ],
  tritanopia: [
    0.950, 0.050, 0.000,
    0.000, 0.433, 0.567,
    0.000, 0.475, 0.525
  ],
  normal: [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ]
});

/**
 * Apply a colorblind simulation matrix to an RGB triple.
 * @param {number[]} matrix - 9-element row-major 3×3 matrix from COLORBLIND_MATRICES
 * @param {number} r - Red   [0, 255]
 * @param {number} g - Green [0, 255]
 * @param {number} b - Blue  [0, 255]
 * @returns {{ r: number, g: number, b: number }} Clamped integer RGB
 */
export function applyColorblindFilter(matrix, r, g, b) {
  if (!Array.isArray(matrix) || matrix.length !== 9)
    throw new Error('matrix must be a 9-element array');
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  return {
    r: clamp(matrix[0] * r + matrix[1] * g + matrix[2] * b),
    g: clamp(matrix[3] * r + matrix[4] * g + matrix[5] * b),
    b: clamp(matrix[6] * r + matrix[7] * g + matrix[8] * b)
  };
}

// ── High-contrast palette swap ────────────────────────────────────────────────
// Terrain/unit color tokens -> high-contrast overrides.
const HIGH_CONTRAST_MAP = {
  open:     '#ffffff',
  road:     '#ffff00',
  forest:   '#00ff00',
  rough:    '#ff8800',
  blocking: '#000000',
  unit_a:   '#00cfff',
  unit_b:   '#ff4444',
  fog:      '#222222'
};

/**
 * Apply high-contrast overrides to a palette object.
 * Unknown keys are passed through unchanged.
 * @param {Object} colors - { [token]: cssColorString }
 * @param {boolean} enabled
 * @returns {Object} New palette object (input not mutated)
 */
export function applyHighContrast(colors, enabled) {
  if (!enabled) return { ...colors };
  const out = {};
  for (const [k, v] of Object.entries(colors)) {
    out[k] = HIGH_CONTRAST_MAP[k] ?? v;
  }
  return out;
}

// ── Screen-reader announcement ring buffer ────────────────────────────────────
const RING_SIZE = 32;

/**
 * Create an aria-live announcement queue (ring buffer, capacity 32).
 * @returns {{ announce: Function, drain: Function, peek: Function, size: Function }}
 */
export function createAnnouncementQueue() {
  const buf = new Array(RING_SIZE).fill(null);
  let head = 0; // next write position
  let count = 0;

  return {
    /** Push a message string onto the queue. Overwrites oldest if full. */
    announce(msg) {
      if (typeof msg !== 'string' || !msg.trim())
        throw new Error('msg must be a non-empty string');
      buf[head % RING_SIZE] = msg;
      head = (head + 1) % RING_SIZE;
      if (count < RING_SIZE) count++;
    },
    /** Drain and return all pending messages in FIFO order. */
    drain() {
      if (count === 0) return [];
      const start = (head - count + RING_SIZE) % RING_SIZE;
      const out = [];
      for (let i = 0; i < count; i++) out.push(buf[(start + i) % RING_SIZE]);
      count = 0;
      return out;
    },
    /** Peek at the most recently announced message without draining. */
    peek() { return count === 0 ? null : buf[(head - 1 + RING_SIZE) % RING_SIZE]; },
    /** Number of messages currently queued. */
    size() { return count; }
  };
}

// ── Keybind validator ─────────────────────────────────────────────────────────
const RESERVED_KEYS = new Set(['Tab', 'Escape', 'F5', 'F11', 'F12']);

/**
 * Validate a keybind map for duplicates and reserved keys.
 * @param {Object} binds - { [actionName]: keyString }
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateKeybinds(binds) {
  const errors = [];
  const seen = new Map(); // key -> actionName

  for (const [action, key] of Object.entries(binds)) {
    if (RESERVED_KEYS.has(key)) {
      errors.push(`Action "${action}" uses reserved key "${key}"`);
    }
    if (seen.has(key)) {
      errors.push(`Duplicate key "${key}" assigned to "${action}" and "${seen.get(key)}"`);
    } else {
      seen.set(key, action);
    }
  }

  return { valid: errors.length === 0, errors };
}
