// test/milestone1d.test.js
// Run: node --test test/milestone1d.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { GameServer } from "../engine/server.js";
import { OP_ACTIVE, ASSET_MOVING } from "../engine/state.js";

test("1D AI Regency claims initial unoccupied assets deterministically", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true });
  const snap = server.step();
  assert.equal(snap.tick, 1);
  for (let assetId = 0; assetId < 8; assetId++) {
    const operatorId = 16 + assetId;
    assert.equal(server.state.operators[operatorId].state, OP_ACTIVE);
    assert.equal(server.state.operators[operatorId].assetId, assetId);
    assert.equal(server.state.assets[assetId].operatorId, operatorId);
  }
  // 16 fixed regents since the 32-asset expansion (ops 16-31).
  assert.equal(snap.views[0].events.filter(e => e.type === "operator_joined").length, 16);
  assert.equal(snap.views[0].events.filter(e => e.type === "asset_selected").length, 16);
});

test("1D AI issues normal move_order commands on its next decision pass", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true });
  server.step(); // AI joins/selects
  server.step(); // AI orders movement, then authoritative tick advances it
  for (let assetId = 0; assetId < 8; assetId++) {
    assert.equal(server.state.assets[assetId].state, ASSET_MOVING);
  }
  assert.ok(server.state.assets[0].x > 7 * 256, "team A regent should advance east");
  assert.ok(server.state.assets[4].x < 117 * 256, "team B regent should advance west");
});

test("1D human command resolves before AI and AI does not evict that human", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true });
  server.enqueue({ type: "join_operator", operatorId: 0, team: 0 });
  server.enqueue({ type: "select_asset", operatorId: 0, assetId: 0 });
  server.step();
  assert.equal(server.state.assets[0].operatorId, 0);
  assert.equal(server.state.operators[0].assetId, 0);
  assert.equal(server.state.operators[16].assetId, -1);
});

test("1D enabled AI produces identical state hashes for identical runs", () => {
  const a = new GameServer({ mapSeed: 99, enableAi: true });
  const b = new GameServer({ mapSeed: 99, enableAi: true });
  for (let tick = 0; tick < 100; tick++) {
    const sa = a.step();
    const sb = b.step();
    assert.equal(sa.stateHash, sb.stateHash, `hash mismatch at tick ${tick + 1}`);
  }
});

test("1D AI is opt-in so 1A/1B behaviour remains unchanged", () => {
  const server = new GameServer({ mapSeed: 42 });
  server.step();
  for (let assetId = 0; assetId < 8; assetId++) {
    assert.equal(server.state.assets[assetId].operatorId, -1);
  }
});
