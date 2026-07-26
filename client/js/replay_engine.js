// client/js/replay_engine.js — Slice 11H: pure replay scrubber (prompt 16
// Q15). The engine is deterministic browser-safe JS, so a downloaded
// replay record re-simulates locally: seek to any tick, scrub backwards,
// step forwards — all from the command log, no server involved.
// Checkpoints (state references — apply never mutates) make backward
// scrubbing cheap: seek cost is at most `checkpointEvery` applies.

import { apply } from "../../engine/reducer.js";
import { createInitialState } from "../../engine/state.js";

export function createReplayPlayer(record, { checkpointEvery = 200 } = {}) {
  const log = record.commandLog ?? [];
  const initial = createInitialState(
    record.meta.mapSeed >>> 0, record.meta.mapProfile ?? "frontier_corridor");
  // checkpoints[i] = { index: entries applied, state } — ascending ticks.
  const checkpoints = [{ index: 0, state: initial }];
  let cursor = { index: 0, state: initial };

  function lastTick() {
    return record.meta.ticks ?? (log.at(-1)?.tick ?? 0);
  }

  // Advance from a checkpoint until state.tick reaches `tick` (or the log
  // ends). Records new checkpoints on the way.
  function seek(tick) {
    const target = Math.max(0, Math.min(tick, lastTick()));
    let best = checkpoints[0];
    for (const cp of checkpoints) {
      if (cp.state.tick <= target && cp.index >= best.index) best = cp;
    }
    // Reuse the live cursor when it is closer (forward play path).
    if (cursor.state.tick <= target && cursor.index >= best.index) best = cursor;
    let { index, state } = best;
    while (state.tick < target && index < log.length) {
      state = apply(state, log[index].cmd);
      index += 1;
      if (index % checkpointEvery === 0 &&
          !checkpoints.some((cp) => cp.index === index)) {
        checkpoints.push({ index, state });
      }
    }
    cursor = { index, state };
    return state;
  }

  return { seek, lastTick, get state() { return cursor.state; } };
}
