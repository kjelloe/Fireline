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
    w.writeI32LE(o.lastPingTick); // added 10C
    w.writeU8(o.autoRescue ?? 1); // added 11G
    w.writeI32LE(o.respawnTicks ?? 0); w.writeI32LE(o.carrierSpawnAt ?? 0); // added 15/15F
    for (const d of o.deeds ?? []) w.writeI32LE(d); // added B4 (7 deed counters)
  }
  for (const a of state.assets) {
    w.writeI32LE(a.id); w.writeI32LE(a.type); w.writeI32LE(a.team);
    w.writeI32LE(a.state); w.writeI32LE(a.x); w.writeI32LE(a.y);
    w.writeI32LE(a.targetX); w.writeI32LE(a.targetY);
    w.writeI32LE(a.hp); w.writeI32LE(a.operatorId); w.writeU8(a.moveProgress);
    w.writeU8(a.suppressedTimer); // added 1H
    w.writeI32LE(a.ammo); w.writeI32LE(a.fuel); // added 1J
    w.writeI32LE(a.towedBy); w.writeI32LE(a.recoverTimer); // added 8D
    w.writeU8(a.reloadTimer); // added 8E
    w.writeU8(a.heading); // added 9F
    w.writeI32LE(a.aboard1); w.writeI32LE(a.aboard2); // added 9B
    w.writeU8(a.minesLeft); // added 9E
    w.writeU8(a.caltropsLeft ?? 0); // added Q45
    w.writeU8(a.sandbagsLeft ?? 0); // added Q45/Q50
    w.writeI32LE(a.campTicks); // added 9G
    w.writeU8(a.materiel ?? 0); // added 11F
    w.writeI32LE(a.driveThrottle ?? 0); w.writeI32LE(a.driveTurn ?? 0); // added 11L
    w.writeU8(a.deployed ?? 0); w.writeU8(a.deployTimer ?? 0); // added 12B
    w.writeI32LE(a.abandonTimer ?? 0); // added 15
    w.writeI32LE(a.cargoFuel ?? 0); w.writeI32LE(a.cargoAmmo ?? 0); // added 13A
    w.writeI32LE(a.stationOp ?? -1); w.writeI32LE(a.stationAmmo ?? 0); w.writeI32LE(a.stationReload ?? 0); // added prompt-100 stations
    w.writeI32LE(a.ejectTimer ?? 0); // added Q41 eject
    w.writeI32LE(a.prisoner ?? -1); w.writeI32LE(a.captureTicks ?? 0); // added POW slice 2
  }
  for (const s of state.sites) { // added 1I
    w.writeI32LE(s.id); w.writeI32LE(s.type); w.writeI32LE(s.owner);
    w.writeI32LE(s.cellX); w.writeI32LE(s.cellY);
  w.writeI32LE(s.captureProgress); w.writeI32LE(s.capturingTeam); // added 11B
  w.writeI32LE(s.hp ?? 60); // added 11F
  w.writeI32LE(s.kind ?? 0); // added B2 (typed node classes)
  }
  for (const b of state.bases) { // added 1J
    w.writeI32LE(b.team); w.writeI32LE(b.x); w.writeI32LE(b.y);
    w.writeI32LE(b.width); w.writeI32LE(b.height);
  }
  for (const st of state.standards) { // added 8A
    w.writeI32LE(st.id); w.writeI32LE(st.team); w.writeI32LE(st.x); w.writeI32LE(st.y);
    w.writeI32LE(st.homeCellX); w.writeI32LE(st.homeCellY);
    w.writeI32LE(st.carrierAssetId); w.writeI32LE(st.status);
    w.writeI32LE(st.droppedTimer); // added 9A
  }
  for (const m of (state.manufacture ?? [0, 0])) w.writeI32LE(m); // added 9D
  for (const t of (state.tickets ?? [0, 0])) w.writeI32LE(t); // added 13H
  for (const d of (state.downed ?? [])) { // added 9B
    w.writeI32LE(d.operatorId); w.writeI32LE(d.team);
    w.writeI32LE(d.x); w.writeI32LE(d.y);
    w.writeI32LE(d.targetX); w.writeI32LE(d.targetY);
    w.writeI32LE(d.downTicks);
    w.writeI32LE(d.satchel ?? 0); // added prompt-51
    w.writeI32LE(d.freedPow ?? 0); // added POW arc
    w.writeI32LE(d.resecureTicks ?? 0); // added review-2 re-secure
  }
  w.writeI32LE(state.rules?.mpgMinOperable ?? 6); w.writeI32LE(state.rules?.mpgTicks ?? 900); // added 13F
  w.writeI32LE(state.nextMineId ?? 0); // added 9E
  for (const m of (state.mines ?? [])) {
    w.writeI32LE(m.id); w.writeI32LE(m.team);
    w.writeI32LE(m.cellX); w.writeI32LE(m.cellY);
    w.writeI32LE(m.armTimer); w.writeU8(m.marked);
  }
  w.writeI32LE(state.landship?.respawnTicks ?? 0); w.writeI32LE(state.landship?.spawnIdx ?? 0); // added Q42
  w.writeI32LE(state.nextSandbagId ?? 0); // added Q45/Q50
  for (const sb of (state.sandbags ?? [])) {
    w.writeI32LE(sb.id); w.writeI32LE(sb.team);
    w.writeI32LE(sb.cellX); w.writeI32LE(sb.cellY);
    w.writeI32LE(sb.hp); w.writeI32LE(sb.buildTicks); w.writeI32LE(sb.prevTerrain);
  }
  w.writeI32LE(state.nextCaltropId ?? 0); // added Q45
  for (const c of (state.caltrops ?? [])) {
    w.writeI32LE(c.id); w.writeI32LE(c.team);
    w.writeI32LE(c.cellX); w.writeI32LE(c.cellY);
    w.writeI32LE(c.ticksLeft);
  }
  w.writeI32LE(state.nextDroneId ?? 0); // added 9G
  for (const d of (state.drones ?? [])) {
    w.writeI32LE(d.id); w.writeI32LE(d.team);
    w.writeI32LE(d.x); w.writeI32LE(d.y);
    w.writeI32LE(d.targetAssetId); w.writeI32LE(d.ageTicks); w.writeI32LE(d.hitTimer);
  }
  for (const a of (state.assets ?? [])) { // added item-34 waypoints
    w.writeI32LE((a.waypoints ?? []).length);
    for (const wp of (a.waypoints ?? [])) { w.writeI32LE(wp.x); w.writeI32LE(wp.y); }
  }
  for (const b of (state.bridges ?? [])) { // added 13E — empty = no bytes
    w.writeI32LE(b.id); w.writeI32LE(b.hp);
  }
  for (const d of (state.drops ?? [])) { // added B6 (supply drop schedule + hold)
    w.writeI32LE(d.id); w.writeI32LE(d.cellY); w.writeI32LE(d.activateTick);
    w.writeI32LE(d.holdTicks); w.writeI32LE(d.heldBy); w.writeI32LE(d.securedBy);
  }
  for (const sv of (state.salvage ?? [0, 0])) w.writeI32LE(sv); // added salvage era
  for (const c of (state.convoy ?? [])) { // added Last Convoy
    w.writeI32LE(c.active); w.writeI32LE(c.need); w.writeI32LE(c.done);
    w.writeI32LE(c.ids.length);
    for (const id of c.ids) w.writeI32LE(id);
  }
  for (const p of (state.prisons ?? [])) { // added POW arc slice 1
    w.writeI32LE(p.team); w.writeI32LE(p.cellX); w.writeI32LE(p.cellY);
    w.writeI32LE(p.raidTicks); w.writeI32LE(p.alarmTicks ?? 0); w.writeI32LE(p.pows.length);
    for (const pow of p.pows) { w.writeI32LE(pow.id); w.writeI32LE(pow.by); } // {id,by} since slice 2
  }
  if (state.mission) { // mode framework: hashed ONLY when a mission is live
    const m = state.mission;
    w.writeI32LE(m.kind); w.writeI32LE(m.attacker); w.writeI32LE(m.convoyId);
    w.writeI32LE(m.gateCellX); w.writeI32LE(m.gateCellY); w.writeI32LE(m.timerTicks); w.writeI32LE(m.restartTicks);
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
