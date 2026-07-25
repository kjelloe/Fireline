// engine/clock.js — Milestone 1B/1F
// 10 Hz TickClock. start/stop is idempotent.

const TICK_INTERVAL_MS = 100;

export class TickClock {
  constructor(onTick) {
    this._onTick   = onTick;
    this._timer    = null;
    this._running  = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._timer = setInterval(() => this._onTick(), TICK_INTERVAL_MS);
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    clearInterval(this._timer);
    this._timer = null;
  }

  get running() { return this._running; }
}
