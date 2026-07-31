// test/milestone1a.test.js
// Milestone 1A: authoritative reducer parity gate.
// Run: node --test test/milestone1a.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createByteWriter, computeFnv1a64, hashToHex64 } from "../shared/canonical.js";
import { createInitialState } from "../engine/state.js";
import { validate } from "../engine/commands.js";
import { apply } from "../engine/reducer.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/1A_reducer.json", import.meta.url)));

function stateHash(s) {
  const w = createByteWriter();
  w.writeU32LE(s.tick);
  w.writeU32LE(s.mapSeed);
  for (const sc of s.teamScores) w.writeI32LE(sc);
  w.writeI32LE(s.phase); w.writeI32LE(s.winner); w.writeI32LE(s.winReason); // added 3E
  w.writeI32LE(s.dominationTeam); w.writeI32LE(s.dominationTicks);
  for (const o of s.operators) {
    w.writeI32LE(o.id); w.writeI32LE(o.team); w.writeI32LE(o.state);
    w.writeI32LE(o.assetId); w.writeI32LE(o.score); w.writeI32LE(o.downTimer);
    w.writeI32LE(o.lastPingTick); // added 10C
    w.writeU8(o.autoRescue ?? 1); // added 11G
    w.writeI32LE(o.respawnTicks ?? 0); w.writeI32LE(o.carrierSpawnAt ?? 0); // added 15/15F
    for (const d of o.deeds ?? []) w.writeI32LE(d); // added B4 (7 deed counters)
  }
  for (const a of s.assets) {
    w.writeI32LE(a.id); w.writeI32LE(a.type); w.writeI32LE(a.team);
    w.writeI32LE(a.state); w.writeI32LE(a.x); w.writeI32LE(a.y);
    w.writeI32LE(a.targetX); w.writeI32LE(a.targetY);
    w.writeI32LE(a.hp); w.writeI32LE(a.operatorId);
    w.writeU8(a.moveProgress);
    w.writeU8(a.suppressedTimer); // added 1H
    w.writeI32LE(a.ammo); w.writeI32LE(a.fuel); // added 1J
    w.writeI32LE(a.towedBy); w.writeI32LE(a.recoverTimer); // added 8D
    w.writeU8(a.reloadTimer); // added 8E
    w.writeU8(a.heading); // added 9F
    w.writeI32LE(a.aboard1); w.writeI32LE(a.aboard2); // added 9B
    w.writeU8(a.minesLeft); // added 9E
    w.writeU8(a.caltropsLeft ?? 0); // added Q45
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
  for (const site of s.sites) { // added 1I
    w.writeI32LE(site.id); w.writeI32LE(site.type); w.writeI32LE(site.owner);
    w.writeI32LE(site.cellX); w.writeI32LE(site.cellY);
  w.writeI32LE(site.captureProgress); w.writeI32LE(site.capturingTeam); // added 11B
  w.writeI32LE(site.hp ?? 60); // added 11F
  w.writeI32LE(site.kind ?? 0); // added B2 (typed node classes)
  }
  for (const b of s.bases) { // added 1J
    w.writeI32LE(b.team); w.writeI32LE(b.x); w.writeI32LE(b.y);
    w.writeI32LE(b.width); w.writeI32LE(b.height);
  }
  for (const st of s.standards) { // added 8A
    w.writeI32LE(st.id); w.writeI32LE(st.team); w.writeI32LE(st.x); w.writeI32LE(st.y);
    w.writeI32LE(st.homeCellX); w.writeI32LE(st.homeCellY);
    w.writeI32LE(st.carrierAssetId); w.writeI32LE(st.status);
    w.writeI32LE(st.droppedTimer); // added 9A
  }
  for (const m of (s.manufacture ?? [0, 0])) w.writeI32LE(m); // added 9D
  for (const t of (s.tickets ?? [0, 0])) w.writeI32LE(t); // added 13H
  for (const d of (s.downed ?? [])) { // added 9B
    w.writeI32LE(d.operatorId); w.writeI32LE(d.team);
    w.writeI32LE(d.x); w.writeI32LE(d.y);
    w.writeI32LE(d.targetX); w.writeI32LE(d.targetY);
    w.writeI32LE(d.downTicks);
    w.writeI32LE(d.satchel ?? 0); // added prompt-51
    w.writeI32LE(d.freedPow ?? 0); // added POW arc
    w.writeI32LE(d.resecureTicks ?? 0); // added review-2 re-secure
  }
  w.writeI32LE(s.rules?.mpgMinOperable ?? 6); w.writeI32LE(s.rules?.mpgTicks ?? 900); // added 13F
  w.writeI32LE(s.nextMineId ?? 0); // added 9E
  for (const m of (s.mines ?? [])) {
    w.writeI32LE(m.id); w.writeI32LE(m.team);
    w.writeI32LE(m.cellX); w.writeI32LE(m.cellY);
    w.writeI32LE(m.armTimer); w.writeU8(m.marked);
  }
  w.writeI32LE(s.nextCaltropId ?? 0); // added Q45
  for (const c of (s.caltrops ?? [])) {
    w.writeI32LE(c.id); w.writeI32LE(c.team);
    w.writeI32LE(c.cellX); w.writeI32LE(c.cellY);
    w.writeI32LE(c.ticksLeft);
  }
  w.writeI32LE(s.nextDroneId ?? 0); // added 9G
  for (const d of (s.drones ?? [])) {
    w.writeI32LE(d.id); w.writeI32LE(d.team);
    w.writeI32LE(d.x); w.writeI32LE(d.y);
    w.writeI32LE(d.targetAssetId); w.writeI32LE(d.ageTicks); w.writeI32LE(d.hitTimer);
  }
  for (const a of (s.assets ?? [])) { // added item-34 waypoints
    w.writeI32LE((a.waypoints ?? []).length);
    for (const wp of (a.waypoints ?? [])) { w.writeI32LE(wp.x); w.writeI32LE(wp.y); }
  }
  for (const b of (s.bridges ?? [])) { // added 13E — empty on frontier, so no repin
    w.writeI32LE(b.id); w.writeI32LE(b.hp);
  }
  for (const d of (s.drops ?? [])) { // added B6 (supply drop schedule + hold)
    w.writeI32LE(d.id); w.writeI32LE(d.cellY); w.writeI32LE(d.activateTick);
    w.writeI32LE(d.holdTicks); w.writeI32LE(d.heldBy); w.writeI32LE(d.securedBy);
  }
  for (const sv of (s.salvage ?? [0, 0])) w.writeI32LE(sv); // added salvage era
  for (const c of (s.convoy ?? [])) { // added Last Convoy
    w.writeI32LE(c.active); w.writeI32LE(c.need); w.writeI32LE(c.done);
    w.writeI32LE(c.ids.length);
    for (const id of c.ids) w.writeI32LE(id);
  }
  for (const p of (s.prisons ?? [])) { // added POW arc slice 1
    w.writeI32LE(p.team); w.writeI32LE(p.cellX); w.writeI32LE(p.cellY);
    w.writeI32LE(p.raidTicks); w.writeI32LE(p.pows.length);
    for (const pow of p.pows) { w.writeI32LE(pow.id); w.writeI32LE(pow.by); } // {id,by} since slice 2
  }
  if (s.mission) { // mode framework: hashed ONLY when a mission is live
    const m = s.mission;
    w.writeI32LE(m.kind); w.writeI32LE(m.attacker); w.writeI32LE(m.convoyId);
    w.writeI32LE(m.gateCellX); w.writeI32LE(m.gateCellY); w.writeI32LE(m.timerTicks); w.writeI32LE(m.restartTicks);
  }
  const { hashHi, hashLo } = computeFnv1a64(w.toBytes());
  return hashToHex64(hashHi, hashLo);
}

test("1A initial state hash", () => {
  const s = createInitialState(fx.mapSeed, fx.mapProfile);
  assert.equal(stateHash(s), fx.initialStateHash, "initial state hash mismatch");
});

test("1A command sequence state hashes and events", () => {
  let s = createInitialState(fx.mapSeed, fx.mapProfile);
  for (const step of fx.steps) {
    s = apply(s, step.command);
    assert.equal(stateHash(s), step.stateHashAfter,
      `hash mismatch after ${JSON.stringify(step.command)}`);
    assert.equal(s.events.length, step.events.length,
      `event count mismatch after ${step.command.type}`);
    for (let i = 0; i < step.events.length; i++) {
      assert.equal(s.events[i].type, step.events[i].type,
        `event[${i}].type mismatch after ${step.command.type}`);
    }
  }
  assert.equal(stateHash(s), fx.finalStateHash, "final state hash mismatch");
});

test("1A command validation rejection cases", () => {
  for (const rc of fx.rejectionCases) {
    const v = validate(rc.command);
    assert.equal(v.ok, false, `${rc.id} should be rejected`);
    assert.equal(v.reason, rc.expectedReason, `${rc.id} wrong reason: ${v.reason}`);
  }
});

test("1A reducer never mutates input state", () => {
  const s = createInitialState(fx.mapSeed, fx.mapProfile);
  const h0 = stateHash(s);
  apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  apply(s, { type: "advance_tick" });
  assert.equal(stateHash(s), h0, "input state was mutated");
});

test("1A fog view hides enemy positions outside radius", () => {
  // Dynamic import to keep test self-contained
  return import("../engine/view.js").then(({ buildView }) => {
    let s = createInitialState(fx.mapSeed, fx.mapProfile);
    s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
    const view = buildView(s, 0);
    // Team A assets should all be in friendlyAssets
    assert.ok(view.friendlyAssets.length > 0, "no friendly assets in view");
    // Team B assets are far away — should not be visible
    assert.equal(view.visibleEnemies.length, 0, "enemy assets should not be visible at start");
  });
});
