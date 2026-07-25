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
  // 3E victory bookkeeping
  w.writeI32LE(state.phase); w.writeI32LE(state.winner); w.writeI32LE(state.winReason);
  w.writeI32LE(state.dominationTeam); w.writeI32LE(state.dominationTicks);
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
    w.writeI32LE(a.ammo); w.writeI32LE(a.fuel); // added 1J
    w.writeI32LE(a.towedBy); w.writeI32LE(a.recoverTimer); // added 8D
  }
  for (const s of state.sites) { // added 1I
    w.writeI32LE(s.id); w.writeI32LE(s.type); w.writeI32LE(s.owner);
    w.writeI32LE(s.cellX); w.writeI32LE(s.cellY);
  }
  for (const b of state.bases) { // added 1J
    w.writeI32LE(b.team); w.writeI32LE(b.x); w.writeI32LE(b.y);
    w.writeI32LE(b.width); w.writeI32LE(b.height);
  }
  for (const st of state.standards) { // added 8A
    w.writeI32LE(st.id); w.writeI32LE(st.team); w.writeI32LE(st.x); w.writeI32LE(st.y);
    w.writeI32LE(st.homeCellX); w.writeI32LE(st.homeCellY);
    w.writeI32LE(st.carrierAssetId); w.writeI32LE(st.status);
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
