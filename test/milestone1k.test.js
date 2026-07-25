// test/milestone1k.test.js — Milestone 1K: command log + hash reconstruction.
// The determinism keystone: replaying the recorded log reproduces the exact
// live state hash. Covers the five acceptance criteria in phases/phase1/plan.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import { recordCommand, replayLog } from "../engine/replay.js";
import { createInitialState } from "../engine/reducer.js";
import { hashState } from "../engine/snapshot.js";
import { GameServer } from "../engine/server.js";

test("1K empty log replay matches initial state hash", () => {
  const initial = createInitialState(42, "frontier_corridor");
  const replayed = replayLog(initial, []);
  assert.equal(hashState(replayed), hashState(initial));
});

test("1K single command replay matches live hash", () => {
  const initial = createInitialState(42, "frontier_corridor");
  const server = new GameServer({ mapSeed: 42 });
  server.enqueue({ type: "join_operator", operatorId: 0, team: 0 });
  server.step();
  const replayed = replayLog(initial, server.commandLog);
  assert.equal(hashState(replayed), server.getLatestSnapshot().stateHash);
});

test("1K 50-tick command sequence replay matches live hash", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true });
  for (let i = 0; i < 50; i++) {
    if (i === 5) {
      server.enqueue({ type: "join_operator", operatorId: 0, team: 0 });
      server.enqueue({ type: "select_asset", operatorId: 0, assetId: 0 });
    }
    if (i === 10) {
      server.enqueue({ type: "move_order", operatorId: 0, targetCellX: 40, targetCellY: 60 });
    }
    if (i === 30) {
      server.enqueue({ type: "fire_order", operatorId: 0, targetAssetId: 5 });
    }
    server.step();
  }
  const initial = createInitialState(42, "frontier_corridor");
  const replayed = replayLog(initial, server.commandLog);
  assert.equal(hashState(replayed), server.getLatestSnapshot().stateHash);
  assert.equal(replayed.tick, 50);
});

test("1K replay is deterministic across two runs", () => {
  const server = new GameServer({ mapSeed: 9, enableAi: true });
  for (let i = 0; i < 30; i++) server.step();
  const initial1 = createInitialState(9, "frontier_corridor");
  const initial2 = createInitialState(9, "frontier_corridor");
  const h1 = hashState(replayLog(initial1, server.commandLog));
  const h2 = hashState(replayLog(initial2, server.commandLog));
  assert.equal(h1, h2);
});

test("1K out-of-order commands are rejected by replay", () => {
  const log = [];
  recordCommand(log, 0, { type: "advance_tick" });
  recordCommand(log, 1, { type: "advance_tick" });
  assert.throws(() => recordCommand(log, 0, { type: "advance_tick" }), /out-of-order/);

  const tampered = [
    { tick: 5, cmd: { type: "advance_tick" } },
    { tick: 2, cmd: { type: "advance_tick" } },
  ];
  const initial = createInitialState(1, "frontier_corridor");
  assert.throws(() => replayLog(initial, tampered), /out-of-order/);
});

// ── additional 1K self-tests ──────────────────────────────────────────────────

test("1K log records client, AI, and tick commands in authoritative order", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true });
  server.enqueue({ type: "join_operator", operatorId: 0, team: 0 });
  server.step();
  const types = server.commandLog.map((e) => e.cmd.type);
  assert.equal(types[0], "join_operator", "human command first");
  assert.equal(types.at(-1), "advance_tick", "tick closes the step");
  assert.ok(types.filter((t) => t === "join_operator").length >= 9, "AI joins recorded");
});

test("1K replay does not mutate the initial state it starts from", () => {
  const server = new GameServer({ mapSeed: 3, enableAi: true });
  for (let i = 0; i < 10; i++) server.step();
  const initial = createInitialState(3, "frontier_corridor");
  const before = hashState(initial);
  replayLog(initial, server.commandLog);
  assert.equal(hashState(initial), before);
});
