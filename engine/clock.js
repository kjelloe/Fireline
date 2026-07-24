// engine/clock.js
// Thin real-time adapter around the authoritative tick loop.
// It does not own game state. Determinism remains in Server.step() and the reducer.

export const TICKS_PER_SECOND = 10;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

export class TickClock {
  constructor(onTick, options = {}) {
    if (typeof onTick !== "function") throw new TypeError("onTick must be a function");
    this.onTick = onTick;
    this.intervalMs = options.intervalMs ?? TICK_MS;
    this.setIntervalFn = options.setIntervalFn ?? setInterval;
    this.clearIntervalFn = options.clearIntervalFn ?? clearInterval;
    this.timerId = null;
  }

  get running() { return this.timerId !== null; }

  start() {
    if (this.running) return false;
    this.timerId = this.setIntervalFn(() => this.onTick(), this.intervalMs);
    return true;
  }

  stop() {
    if (!this.running) return false;
    this.clearIntervalFn(this.timerId);
    this.timerId = null;
    return true;
  }
}
