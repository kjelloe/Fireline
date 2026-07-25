// engine/server.js — Milestone 1F
// Command queue -> reducer -> snapshot ring.
// Passes live map object to reducer for terrain speed lookups.

import { createInitialState } from "./state.js";
import { apply } from "./reducer.js";
import { buildView } from "./view.js";
import { generateMap } from "./mapgen.js";

const RING_SIZE = 30;

export class GameServer {
  constructor(seed) {
    this.state    = createInitialState(seed);
    this.map      = generateMap(this.state.mapSeed, this.state.mapWidth, this.state.mapHeight);
    this.queue    = [];
    this.ring     = [];
    this.sessions = {};
  }

  enqueue(command) {
    if (command.type === "advance_tick") return; // server-owned
    this.queue.push(command);
  }

  tick() {
    // Drain client commands FIFO
    while (this.queue.length > 0) {
      const cmd = this.queue.shift();
      const result = apply(this.state, cmd, this.map);
      this.state = result.state;
    }

    // Authoritative tick
    const result = apply(this.state, { type: "advance_tick" }, this.map);
    this.state = result.state;

    // Build snapshot
    const snapshot = {
      tick: this.state.tick,
      views: {
        0: buildView(this.state, 0),
        1: buildView(this.state, 1),
      },
    };

    // Ring buffer
    if (this.ring.length >= RING_SIZE) this.ring.shift();
    this.ring.push(snapshot);

    return snapshot;
  }

  latestSnapshot() {
    return this.ring[this.ring.length - 1] || null;
  }

  registerSession(operatorId, team, ws) {
    this.sessions[operatorId] = { operatorId, team, ws };
  }

  removeSession(operatorId) {
    delete this.sessions[operatorId];
  }
}
