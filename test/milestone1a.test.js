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
  for (const o of s.operators) {
    w.writeI32LE(o.id); w.writeI32LE(o.team); w.writeI32LE(o.state);
    w.writeI32LE(o.assetId); w.writeI32LE(o.score); w.writeI32LE(o.downTimer);
  }
  for (const a of s.assets) {
    w.writeI32LE(a.id); w.writeI32LE(a.type); w.writeI32LE(a.team);
    w.writeI32LE(a.state); w.writeI32LE(a.x); w.writeI32LE(a.y);
    w.writeI32LE(a.targetX); w.writeI32LE(a.targetY);
    w.writeI32LE(a.hp); w.writeI32LE(a.operatorId);
    w.writeU8(a.moveProgress);
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
