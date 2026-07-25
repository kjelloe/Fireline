// engine/snapshot.js
// Canonical server snapshot construction. Views are presentation/network payloads;
// the state hash identifies the exact authoritative state at the snapshot tick.

import { createByteWriter, computeFnv1a64, hashToHex64 } from "../shared/canonical.js";
import { buildView } from "./view.js";

export function hashState(state) {
  const w = createByteWriter();
  w.writeU32LE(state.tick);
  w.writeU32LE(state.mapSeed);
  for (const score of state.teamScores) w.writeI32LE(score);
  for (const o of state.operators) {
    w.writeI32LE(o.id); w.writeI32LE(o.team); w.writeI32LE(o.state);
    w.writeI32LE(o.assetId); w.writeI32LE(o.score); w.writeI32LE(o.downTimer);
  }
  for (const a of state.assets) {
    w.writeI32LE(a.id); w.writeI32LE(a.type); w.writeI32LE(a.team);
    w.writeI32LE(a.state); w.writeI32LE(a.x); w.writeI32LE(a.y);
    w.writeI32LE(a.targetX); w.writeI32LE(a.targetY);
    w.writeI32LE(a.hp); w.writeI32LE(a.operatorId); w.writeU8(a.moveProgress);
    w.writeU8(a.suppressedTimer); // added 1H
  }
  const { hashHi, hashLo } = computeFnv1a64(w.toBytes());
  return hashToHex64(hashHi, hashLo);
}

export function createSnapshot(state) {
  return {
    tick: state.tick,
    stateHash: hashState(state),
    // State is never exposed here: only fog-filtered views are transport payloads.
    views: [buildView(state, 0), buildView(state, 1)],
  };
}
