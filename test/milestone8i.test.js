// test/milestone8i.test.js — Milestone 8I: heartbeats + balance instrumentation.

import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createAppServer } from "../server/index.js";
import { createMetrics } from "../server/metrics.js";

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

test("8I silent sessions are terminated and fall to regency; live ones survive", async () => {
  const appServer = createAppServer({ mapSeed: 42, enableAi: false });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    const ws = new WebSocket(`ws://localhost:${addr.port}`);
    await new Promise((r) => ws.on("open", r));
    ws.send(JSON.stringify({ type: "c_join", operatorId: 6, team: 0 }));
    await settle();
    appServer.gameServer.step();
    assert.equal(appServer.transport.sessions.size, 1);

    // Fresh session: sweep pings it, keeps it.
    let dropped = appServer.transport.checkHeartbeats(Date.now(), 5000);
    assert.deepEqual(dropped, []);
    assert.equal(appServer.transport.sessions.size, 1);

    // Simulate silence by aging the bookkeeping, then sweep.
    for (const session of appServer.transport.sessions.values()) {
      session.lastSeenMs = Date.now() - 60000;
    }
    dropped = appServer.transport.checkHeartbeats(Date.now(), 5000);
    assert.deepEqual(dropped, [6]);
    await settle();
    assert.equal(appServer.transport.sessions.size, 0, "session culled");
    assert.ok(appServer.gameServer.ai?.regented.has(6), "regency takes the slot");
  } finally {
    await appServer.stop();
  }
});

test("8I pong refreshes the heartbeat bookkeeping", async () => {
  const appServer = createAppServer({ mapSeed: 42, enableAi: false });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    const ws = new WebSocket(`ws://localhost:${addr.port}`);
    await new Promise((r) => ws.on("open", r));
    ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await settle();
    const session = [...appServer.transport.sessions.values()][0];
    session.lastSeenMs = Date.now() - 4000; // aging but not dead
    appServer.transport.checkHeartbeats(Date.now(), 5000); // sends ping → client pongs
    await settle();
    assert.ok(Date.now() - session.lastSeenMs < 1000, "pong refreshed lastSeen");
    ws.close();
  } finally {
    await appServer.stop();
  }
});

test("8I metrics accumulate the designer's balance measurables", () => {
  const m = createMetrics();
  m.consumeEvents([
    { type: "standard_taken", standardId: 1, assetId: 0, byTeam: 0 },
    { type: "standard_dropped", standardId: 1 },
    { type: "standard_returned", standardId: 1, team: 1 },
    { type: "site_captured", siteId: 0, team: 0 },
    { type: "asset_disabled", assetId: 4 },
    { type: "tow_started", assetId: 4, by: 0 },
    { type: "asset_restored", assetId: 4 },
    { type: "rejected", cmd: "fire_order", reason: "reloading" },
    { type: "rejected", cmd: "fire_order", reason: "reloading" },
    { type: "rejected", cmd: "move_order", reason: "war is over" },
  ], 120);
  m.warCompleted(900);
  m.warCompleted(1100);

  const snap = m.snapshot();
  assert.equal(snap.standardsTaken, 1);
  assert.equal(snap.standardsReturned, 1);
  assert.equal(snap.relayCaptures, 1);
  assert.equal(snap.disables, 1);
  assert.equal(snap.firstContactTick, 120);
  assert.equal(snap.towsStarted, 1);
  assert.equal(snap.recoveries, 1);
  assert.equal(snap.fireOrdersRejected, 2);
  assert.equal(snap.rejectionsByReason.reloading, 2);
  assert.equal(snap.warsCompleted, 2);
  assert.equal(snap.avgWarTicks, 1000);
});

test("8I /metrics endpoint serves live counters", async () => {
  const appServer = createAppServer({ mapSeed: 42, enableAi: true });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    // Stage a kill so counters move.
    const server = appServer.gameServer;
    appServer.pump(server.step());
    server.state.assets[4].x = server.state.assets[0].x + 512;
    server.state.assets[4].y = server.state.assets[0].y;
    server.state.assets[4].hp = 20;
    for (let i = 0; i < 5; i++) appServer.pump(server.step());

    const body = await (await fetch(`http://localhost:${addr.port}/metrics`)).json();
    assert.ok(body.disables >= 1, `disables: ${body.disables}`);
    assert.equal(typeof body.rejectionsByReason, "object");
  } finally {
    await appServer.stop();
  }
});
