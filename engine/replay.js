// engine/replay.js — command log recording + deterministic replay (slice 1K).
// The core determinism guarantee: folding a recorded command log over the
// initial state reproduces the exact final state hash. Every command is
// recorded — including server-owned advance_tick — so replay is a plain fold.

import { apply } from "./reducer.js";

// Appends {tick, cmd} to the log. Ticks must be non-decreasing.
export function recordCommand(log, tick, cmd) {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new RangeError(`invalid tick: ${tick}`);
  }
  const last = log.at(-1);
  if (last && tick < last.tick) {
    throw new RangeError(`out-of-order command: tick ${tick} after ${last.tick}`);
  }
  log.push({ tick, cmd });
  return log;
}

// Replays a log from an initial state; returns the final state.
export function replayLog(initialState, log) {
  let previousTick = -1;
  let state = initialState;
  for (const entry of log) {
    if (!Number.isInteger(entry.tick) || entry.tick < previousTick) {
      throw new RangeError(`out-of-order log entry at tick ${entry.tick}`);
    }
    previousTick = entry.tick;
    state = apply(state, entry.cmd);
  }
  return state;
}
