// engine/server.js
// Headless authoritative server shell.
// Queue order is authoritative: client commands resolve FIFO, then AI Regency,
// then one server-owned 10 Hz tick. Networking only calls enqueue()/uses snapshots.

import { createInitialState } from "./state.js";
import { apply } from "./reducer.js";
import { CMD_ADVANCE_TICK } from "./commands.js";
import { createSnapshot } from "./snapshot.js";
import { TickClock } from "./clock.js";
import { AIRegency } from "./ai_regency.js";
import { recordCommand } from "./replay.js";

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
    this.aiDifficulty = options.aiDifficulty ?? 1;
    this.ai = options.enableAi === true
      ? new AIRegency({ difficulty: this.aiDifficulty })
      : null;
    // 1K: authoritative command log (client + AI + advance_tick, in order).
    this.commandLog = [];
  }

  enqueue(command) {
    if (command?.type === CMD_ADVANCE_TICK) {
      return { accepted: false, reason: "advance_tick is server-owned" };
    }
    const entry = { sequence: this.nextSequence++, command };
    this.queue.push(entry);
    return { accepted: true, sequence: entry.sequence };
  }

  step() {
    // Copy and clear first, so commands enqueued from external callbacks always
    // wait for the next tick. Client FIFO commands always precede AI commands.
    const queued = this.queue;
    this.queue = [];
    const events = [];

    for (const entry of queued) {
      recordCommand(this.commandLog, this.state.tick, entry.command);
      this.state = apply(this.state, entry.command);
      events.push(...this.state.events);
    }
    if (this.ai) {
      for (const command of this.ai.plan(this.state)) {
        recordCommand(this.commandLog, this.state.tick, command);
        this.state = apply(this.state, command);
        events.push(...this.state.events);
      }
    }
    recordCommand(this.commandLog, this.state.tick, { type: CMD_ADVANCE_TICK });
    this.state = apply(this.state, { type: CMD_ADVANCE_TICK });
    events.push(...this.state.events);
    this.state.events = events;

    const snapshot = createSnapshot(this.state);
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.snapshotCapacity) this.snapshots.shift();
    return snapshot;
  }

  getLatestSnapshot() { return this.snapshots.at(-1) ?? null; }

  // 3C: a disconnected human's operator slot falls to AI regency so the war
  // keeps moving. Lazily creates a regency without fixed agents when the
  // server runs AI-less.
  assumeRegency(operatorId) {
    if (!this.ai) this.ai = new AIRegency({ fixedAgents: false, difficulty: this.aiDifficulty });
    this.ai.assume(operatorId);
  }

  releaseRegency(operatorId) {
    this.ai?.release(operatorId);
  }

  start(options = {}) {
    const { onSnapshot, ...clockOptions } = options;
    if (!this.clock) {
      this.clock = new TickClock(() => {
        const snapshot = this.step();
        if (typeof onSnapshot === "function") onSnapshot(snapshot);
      }, clockOptions);
    }
    return this.clock.start();
  }

  stop() { return this.clock ? this.clock.stop() : false; }
}
