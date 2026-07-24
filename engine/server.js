// engine/server.js
// Headless authoritative server shell.
// Queue order is authoritative: queued commands resolve FIFO, then one 10 Hz tick.
// Networking should only call enqueue() and distribute the returned snapshots.

import { createInitialState } from "./state.js";
import { apply } from "./reducer.js";
import { CMD_ADVANCE_TICK } from "./commands.js";
import { createSnapshot } from "./snapshot.js";
import { TickClock } from "./clock.js";

export class GameServer {
  constructor(options = {}) {
    this.state = createInitialState(options.mapSeed ?? 0, options.mapProfile ?? "frontier_corridor");
    this.snapshotCapacity = options.snapshotCapacity ?? 30;
    if (!Number.isInteger(this.snapshotCapacity) || this.snapshotCapacity < 1) {
      throw new RangeError("snapshotCapacity must be a positive integer");
    }
    this.queue = [];
    this.nextSequence = 0;
    this.snapshots = [];
    this.clock = null;
  }

  enqueue(command) {
    // The clock exclusively advances time. This prevents clients from injecting ticks.
    if (command?.type === CMD_ADVANCE_TICK) {
      return { accepted: false, reason: "advance_tick is server-owned" };
    }
    const entry = { sequence: this.nextSequence++, command };
    this.queue.push(entry);
    return { accepted: true, sequence: entry.sequence };
  }

  step() {
    const queued = this.queue;
    this.queue = [];
    const events = [];

    for (const entry of queued) {
      this.state = apply(this.state, entry.command);
      events.push(...this.state.events);
    }
    this.state = apply(this.state, { type: CMD_ADVANCE_TICK });
    events.push(...this.state.events);
    // Preserve the complete event batch for this snapshot tick.
    this.state.events = events;

    const snapshot = createSnapshot(this.state);
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.snapshotCapacity) this.snapshots.shift();
    return snapshot;
  }

  getLatestSnapshot() { return this.snapshots.at(-1) ?? null; }

  start(options = {}) {
    if (!this.clock) {
      this.clock = new TickClock(() => this.step(), options);
    }
    return this.clock.start();
  }

  stop() { return this.clock ? this.clock.stop() : false; }
}
