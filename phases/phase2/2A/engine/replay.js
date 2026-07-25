// engine/replay.js — deterministic replay log (1K)

import { apply } from './reducer.js';

export function replay(initialState, commandLog) {
  let state = { ...initialState, commands: [] };
  for (const cmd of commandLog) {
    state = apply(state, cmd);
  }
  return state;
}
