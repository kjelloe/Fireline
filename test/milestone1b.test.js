// test/milestone1b.test.js
// Run: node --test test/milestone1b.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { TICK_MS, TickClock } from "../engine/clock.js";
import { GameServer } from "../engine/server.js";

test("1B tick clock contract and idempotent lifecycle", () => {
  let callback = null;
  let cleared = null;
  const clock = new TickClock(() => { callback?.(); }, {
    setIntervalFn(fn, ms) { callback = fn; assert.equal(ms, TICK_MS); return 77; },
    clearIntervalFn(id) { cleared = id; },
  });
  assert.equal(clock.running, false);
  assert.equal(clock.start(), true);
  assert.equal(clock.running, true);
  assert.equal(clock.start(), false, "start must be idempotent");
  assert.equal(clock.stop(), true);
  assert.equal(cleared, 77);
  assert.equal(clock.running, false);
  assert.equal(clock.stop(), false, "stop must be idempotent");
});

test("1B queue drains FIFO before its authoritative tick", () => {
  const server = new GameServer({ mapSeed: 42 });
  assert.deepEqual(server.enqueue({ type: "join_operator", operatorId: 0, team: 0 }), { accepted: true, sequence: 0 });
  assert.deepEqual(server.enqueue({ type: "select_asset", operatorId: 0, assetId: 0 }), { accepted: true, sequence: 1 });
  assert.deepEqual(server.enqueue({ type: "move_order", operatorId: 0, targetCellX: 20, targetCellY: 56 }), { accepted: true, sequence: 2 });
  const snapshot = server.step();
  assert.equal(snapshot.tick, 1);
  assert.equal(server.queue.length, 0);
  assert.deepEqual(snapshot.views[0].events.map(e => e.type), ["operator_joined", "asset_selected", "move_ordered"]);
  assert.equal(server.state.assets[0].state, 1, "asset should be moving");
  assert.equal(server.state.assets[0].x, 7 * 256 + 32, "tick should move after order resolution");
});

test("1B snapshot ring retains exactly its newest capacity", () => {
  const server = new GameServer({ mapSeed: 1, snapshotCapacity: 3 });
  for (let i = 0; i < 5; i++) server.step();
  assert.equal(server.snapshots.length, 3);
  assert.deepEqual(server.snapshots.map(s => s.tick), [3, 4, 5]);
  assert.equal(server.getLatestSnapshot().tick, 5);
  assert.match(server.getLatestSnapshot().stateHash, /^[0-9a-f]{16}$/);
});

test("1B snapshots contain fog-filtered per-team views", () => {
  const server = new GameServer({ mapSeed: 42 });
  const snap = server.step();
  assert.equal(snap.views.length, 2);
  assert.equal(snap.views[0].team, 0);
  assert.equal(snap.views[1].team, 1);
  assert.equal(snap.views[0].visibleEnemies.length, 0);
  assert.equal(snap.views[1].visibleEnemies.length, 0);
  assert.equal("state" in snap, false, "authoritative state must not be transported in snapshot");
});

test("1B clients cannot enqueue authoritative ticks", () => {
  const server = new GameServer();
  const result = server.enqueue({ type: "advance_tick" });
  assert.deepEqual(result, { accepted: false, reason: "advance_tick is server-owned" });
  assert.equal(server.queue.length, 0);
  server.step();
  assert.equal(server.state.tick, 1);
});
