// engine/snapshot.js — Milestone 1B/1F
// Canonical snapshot serialiser.

import { fnv1a64 } from "../shared/hash.js";
import { buildView } from "./view.js";

export function makeSnapshot(state) {
  const raw = JSON.stringify(state);
  const bytes = new TextEncoder().encode(raw);
  const hash = fnv1a64(bytes);
  return {
    tick: state.tick,
    stateHash: hash.toString(16).padStart(16, "0"),
    views: {
      0: buildView(state, 0),
      1: buildView(state, 1),
    },
  };
}
