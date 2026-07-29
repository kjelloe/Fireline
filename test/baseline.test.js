// test/baseline.test.js — Claude's reconstruction self-tests (unit + component +
// integration) beyond the milestone contracts. Guards the seams that broke during
// the original 1F merge: shared-layer edge cases, reducer rejection paths,
// asset handover, fog boundary behavior, and long-run server determinism.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createByteWriter, computeFnv1a64, hashToHex64 } from "../shared/canonical.js";
import { seedSfc32, sfc32Next } from "../shared/prng.js";
import { worldToCellFloor, floorDivI32, manhattanDistanceI32, cellToWorld } from "../shared/fixedmath.js";
import { apply, createInitialState, BASE_SPEED } from "../engine/reducer.js";
import { ASSET_IDLE, ASSET_MOVING, OP_ACTIVE } from "../engine/state.js";
import { buildView, FOG_RADIUS_CELLS } from "../engine/view.js";
import { hashState } from "../engine/snapshot.js";
import { GameServer } from "../engine/server.js";
import { T_OPEN } from "../engine/mapgen.js";
import { makeAsset, sandbox } from "./helpers.js";

// ── shared layer units ────────────────────────────────────────────────────────

test("canonical writer chains, encodes multi-byte utf8, and rejects bad bytes", () => {
  const w = createByteWriter();
  w.writeU8(1).writeU16LE(2).writeBool(true);
  assert.deepEqual(Array.from(w.toBytes()), [1, 2, 0, 1]);

  const utf8 = createByteWriter();
  utf8.writeUtf8U16("Ø"); // U+00D8 → 2 utf8 bytes
  assert.deepEqual(Array.from(utf8.toBytes()), [2, 0, 0xc3, 0x98]);

  assert.throws(() => createByteWriter().writeBytes([256]), /RangeError/);
  assert.throws(() => createByteWriter().writeOptionalU32(1, 5), /RangeError/);
});

test("computeFnv1a64 handles multi-KB input without precision loss", () => {
  const data = new Uint8Array(4096);
  for (let i = 0; i < data.length; i++) data[i] = (i * 7 + 13) & 0xff;
  const a = computeFnv1a64(data);
  const b = computeFnv1a64(data);
  assert.equal(hashToHex64(a.hashHi, a.hashLo), hashToHex64(b.hashHi, b.hashLo));
  assert.equal((a.hashHi >>> 0) === a.hashHi && (a.hashLo >>> 0) === a.hashLo, true);
});

test("sfc32Next is pure: same input state always yields same output", () => {
  const s0 = seedSfc32(1234);
  const r1 = sfc32Next(s0);
  const r2 = sfc32Next(s0);
  assert.equal(r1.value, r2.value);
  assert.deepEqual(r1.nextState, r2.nextState);
  assert.deepEqual(s0, seedSfc32(1234), "seed state must not be mutated");
});

test("fixedmath negative-domain behavior", () => {
  assert.equal(worldToCellFloor(-1), -1);
  assert.equal(worldToCellFloor(-256), -1);
  assert.equal(worldToCellFloor(-257), -2);
  assert.equal(floorDivI32(-1, 256), -1);
  assert.equal(manhattanDistanceI32(-5, -5, 5, 5), 20);
  // cell CENTRES since the mirror fix: -2 -> -512 + 128
  assert.equal(cellToWorld(-2), -384);
});

// ── reducer component behavior ────────────────────────────────────────────────

test("initial state is deterministic and pinned to the 1A fixture", () => {
  const a = createInitialState(42, "frontier_corridor");
  const b = createInitialState(42, "frontier_corridor");
  assert.equal(hashState(a), hashState(b));
  const fx = JSON.parse(
    readFileSync(new URL("./fixtures/1A_reducer.json", import.meta.url))
  );
  assert.equal(hashState(a), fx.initialStateHash, "state.js drifted from pinned 1A fixture");
});

test("unknown map profile throws RangeError", () => {
  assert.throws(() => createInitialState(1, "no_such_profile"), /RangeError/);
});

test("selecting an asset occupied by a teammate is rejected without eviction", () => {
  let s = createInitialState(42, "frontier_corridor");
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: 0 });
  s = apply(s, { type: "join_operator", operatorId: 1, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 1, assetId: 0 });
  assert.deepEqual(s.events, [
    { type: "rejected", cmd: "select_asset", reason: "asset already operated" },
  ]);
  assert.equal(s.assets[0].operatorId, 0);
  assert.equal(s.operators[1].assetId, -1);
});

test("switching assets releases the previous asset", () => {
  let s = createInitialState(42, "frontier_corridor");
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: 0 });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: 1 });
  assert.equal(s.assets[0].operatorId, -1, "previous asset released");
  assert.equal(s.assets[1].operatorId, 0);
  assert.equal(s.operators[0].assetId, 1);
});

test("move_order without a selected asset is rejected", () => {
  let s = createInitialState(42, "frontier_corridor");
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 10, targetCellY: 10 });
  assert.deepEqual(s.events, [
    { type: "rejected", cmd: "move_order", reason: "no asset selected" },
  ]);
});

test("invalid command emits rejected event and leaves state untouched", () => {
  const s0 = createInitialState(42, "frontier_corridor");
  const h0 = hashState(s0);
  const s1 = apply(s0, { type: "fire_laser" });
  assert.equal(s1.events[0].type, "rejected");
  assert.equal(hashState(s1), h0, "rejected command must not change hashed state");
});

test("moving asset arrives exactly on target and returns to idle", () => {
  const s0 = sandbox([], [], { size: 16 });
  s0.assets = [
    makeAsset(0, { team: 0, x: 0, y: 0, targetX: BASE_SPEED + 4, targetY: 0, state: ASSET_MOVING }),
  ];
  const s1 = apply(s0, { type: "advance_tick" });
  assert.equal(s1.assets[0].x, BASE_SPEED, "first tick moves base speed");
  assert.equal(s1.assets[0].state, ASSET_MOVING);
  const s2 = apply(s1, { type: "advance_tick" });
  assert.equal(s2.assets[0].x, BASE_SPEED + 4, "arrives exactly, no overshoot");
  assert.equal(s2.assets[0].state, ASSET_IDLE, "arrival flips state to idle");
});

// ── fog view component behavior ───────────────────────────────────────────────

test("fog boundary: enemy visible at radius, hidden one cell beyond", () => {
  const atRadius = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: FOG_RADIUS_CELLS },
  ]);
  assert.equal(buildView(atRadius, 0).visibleEnemies.length, 1);

  const beyond = sandbox([
    { team: 0, cellX: 0 },
    { team: 1, cellX: FOG_RADIUS_CELLS + 1 },
  ]);
  assert.equal(buildView(beyond, 0).visibleEnemies.length, 0);
});

test("visible enemy records leak no hp, target, or operator info", () => {
  const s = createInitialState(42, "frontier_corridor");
  s.assets[4].x = s.assets[0].x + 256; // drag an enemy next to asset 0
  s.assets[4].y = s.assets[0].y;
  const view = buildView(s, 0);
  assert.equal(view.visibleEnemies.length, 1);
  const enemy = view.visibleEnemies[0];
  assert.deepEqual(
    Object.keys(enemy).sort(),
    ["deployed", "heading", "id", "state", "team", "type", "x", "y"] /* 12B: a raised hardpoint is externally obvious */,
    "enemy view record stays minimal (heading is externally observable)"
  );
});

// ── server integration ────────────────────────────────────────────────────────

test("server: rejected in-game action surfaces as event in views", () => {
  const server = new GameServer({ mapSeed: 42 });
  server.enqueue({ type: "join_operator", operatorId: 0, team: 0 });
  server.enqueue({ type: "select_asset", operatorId: 0, assetId: 4 }); // enemy asset
  const snap = server.step();
  const rejected = snap.views[0].events.filter((e) => e.type === "rejected");
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason, "asset belongs to other team");
});

test("server: 300-tick AI war stays deterministic and hash-stable", () => {
  const a = new GameServer({ mapSeed: 7, enableAi: true });
  const b = new GameServer({ mapSeed: 7, enableAi: true });
  let lastHash = null;
  for (let i = 0; i < 300; i++) {
    const sa = a.step();
    const sb = b.step();
    assert.equal(sa.stateHash, sb.stateHash, `divergence at tick ${i + 1}`);
    lastHash = sa.stateHash;
  }
  assert.match(lastHash, /^[0-9a-f]{16}$/);
  assert.equal(a.state.tick, 300);
});

test("server: human interleaved with AI remains reproducible", () => {
  const script = (server) => {
    for (let i = 0; i < 120; i++) {
      if (i === 10) {
        server.enqueue({ type: "join_operator", operatorId: 3, team: 1 });
        server.enqueue({ type: "select_asset", operatorId: 3, assetId: 6 });
      }
      if (i === 20) {
        server.enqueue({ type: "move_order", operatorId: 3, targetCellX: 70, targetCellY: 60 });
      }
      server.step();
    }
    return server.getLatestSnapshot().stateHash;
  };
  const h1 = script(new GameServer({ mapSeed: 11, enableAi: true }));
  const h2 = script(new GameServer({ mapSeed: 11, enableAi: true }));
  assert.equal(h1, h2);
  const h3 = script(new GameServer({ mapSeed: 12, enableAi: true }));
  assert.notEqual(h1, h3, "different seed must diverge");
});

test("server: operator slot 3 asset ends under human control, not AI", () => {
  const server = new GameServer({ mapSeed: 11, enableAi: true });
  server.enqueue({ type: "join_operator", operatorId: 3, team: 1 });
  server.enqueue({ type: "select_asset", operatorId: 3, assetId: 6 });
  server.step();
  assert.equal(server.state.assets[6].operatorId, 3);
  assert.equal(server.state.operators[3].state, OP_ACTIVE);
  assert.equal(server.state.operators[22].assetId, -1, "paired AI regent finds slot taken");
});
