// test/milestone2b.test.js — Milestone 2B: WebSocket server & state sync.
// The app server bridges browsers to the authoritative loop: no-lobby joins
// with server-assigned operator slots, command dispatch, fog-filtered
// per-team snapshot broadcast, and client-authority refusal.

import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createAppServer } from "../server/index.js";
import { cellToWorld } from "../shared/fixedmath.js";

function connect(port) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const messages = [];
  ws.on("message", (data) => messages.push(JSON.parse(data)));
  return new Promise((resolve) => ws.on("open", () => resolve({ ws, messages })));
}

const settle = (ms = 50) => new Promise((r) => setTimeout(r, ms));
async function until(cond, ms = 3000) {
  const t0 = Date.now();
  while (!cond() && Date.now() - t0 < ms) await settle(20);
  return cond();
}

async function withServer(fn) {
  const appServer = createAppServer({ mapSeed: 42, enableAi: false });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    await fn(appServer, addr.port);
  } finally {
    await appServer.stop();
  }
}

test("2B join without operatorId gets a server-assigned slot", async () => {
  await withServer(async (appServer, port) => {
    const a = await connect(port);
    const b = await connect(port);
    a.ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await until(() => a.messages.some((m) => m.type === "s_joined"));
    b.ws.send(JSON.stringify({ type: "c_join", team: 1 }));
    await until(() => b.messages.some((m) => m.type === "s_joined"));

    const joinedA = a.messages.find((m) => m.type === "s_joined");
    const joinedB = b.messages.find((m) => m.type === "s_joined");
    assert.equal(joinedA.operatorId, 0);
    assert.equal(joinedB.operatorId, 1, "second client gets next free slot");
    a.ws.close(); b.ws.close();
  });
});

test("2B duplicate operator claim is rejected", async () => {
  await withServer(async (appServer, port) => {
    const a = await connect(port);
    const b = await connect(port);
    a.ws.send(JSON.stringify({ type: "c_join", operatorId: 5, team: 0 }));
    await settle();
    b.ws.send(JSON.stringify({ type: "c_join", operatorId: 5, team: 1 }));
    await settle();
    assert.ok(a.messages.some((m) => m.type === "s_joined"));
    const rejected = b.messages.find((m) => m.type === "s_rejected");
    assert.equal(rejected.reason, "operator already connected");
    a.ws.close(); b.ws.close();
  });
});

test("2B commands dispatch through ws and views broadcast per team", async () => {
  await withServer(async (appServer, port) => {
    const a = await connect(port);
    a.ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await settle();
    a.ws.send(JSON.stringify({ type: "select_asset", assetId: 0 }));
    a.ws.send(JSON.stringify({ type: "move_order", targetCellX: 20, targetCellY: 56 }));
    await settle();

    const snap = appServer.gameServer.step();
    appServer.transport.broadcastSnapshots(snap);
    await settle();

    const snapshotMsg = a.messages.find((m) => m.type === "s_snapshot");
    assert.ok(snapshotMsg, "client receives snapshot");
    assert.equal(snapshotMsg.view.team, 0);
    assert.equal(appServer.gameServer.state.assets[0].operatorId, 0);
    assert.equal(appServer.gameServer.state.assets[0].x, cellToWorld(7) + 32, "move applied");
    assert.equal("visibleEnemies" in snapshotMsg.view, true, "fog-filtered view shape");
    a.ws.close();
  });
});

test("2B client cannot drive the authoritative tick", async () => {
  await withServer(async (appServer, port) => {
    const a = await connect(port);
    a.ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await settle();
    a.ws.send(JSON.stringify({ type: "advance_tick" }));
    await settle();
    const rejected = a.messages.find((m) => m.type === "s_rejected");
    assert.equal(rejected.reason, "advance_tick is server-owned");
    assert.equal(appServer.gameServer.state.tick, 0);
    a.ws.close();
  });
});

test("2B malformed JSON does not kill the server", async () => {
  await withServer(async (appServer, port) => {
    const a = await connect(port);
    a.ws.send("this is not json{{{");
    await settle();
    a.ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    // Poll-wait: under full parallel suite load a fixed settle is flaky.
    for (let i = 0; i < 40 && !a.messages.some((m) => m.type === "s_joined"); i++) {
      await settle(50);
    }
    assert.ok(a.messages.some((m) => m.type === "s_joined"), "server still serves");
    a.ws.close();
  });
});

test("2B disconnect frees the slot reservation", async () => {
  await withServer(async (appServer, port) => {
    const a = await connect(port);
    a.ws.send(JSON.stringify({ type: "c_join", operatorId: 3, team: 0 }));
    for (let i = 0; i < 40 && !appServer.transport.reserved.has(3); i++) await settle(50);
    a.ws.close();
    for (let i = 0; i < 40 && appServer.transport.reserved.has(3); i++) await settle(50);
    assert.equal(appServer.transport.reserved.has(3), false);
  });
});

test("2B health endpoint reports server tick", async () => {
  await withServer(async (appServer, port) => {
    appServer.gameServer.step();
    const res = await fetch(`http://localhost:${port}/health`);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.tick, 1);
  });
});

test("prompt 198: /healthz aliases /health and both report the real version", async () => {
  await withServer(async (appServer, port) => {
    const health = await (await fetch(`http://localhost:${port}/health`)).json();
    const healthz = await (await fetch(`http://localhost:${port}/healthz`)).json();
    assert.equal(healthz.status, "ok", "the sibling-convention path answers");
    assert.equal(healthz.version, health.version, "one handler, two paths");
    // The deployed build must be identifiable from outside — the live
    // site reported "dev" until prompt 198 because nothing passed a
    // version through. package.json is the floor now.
    assert.notEqual(health.version, "dev", "version falls back to package.json, not 'dev'");
    assert.match(health.version, /^\d+\.\d+\.\d+/);
    // Prompt 206: memory pressure must be visible from outside — the
    // shared box caps RSS and a sweep should see the climb coming.
    assert.ok(Number.isInteger(health.rssMb) && health.rssMb > 0, `rssMb=${health.rssMb}`);
  });
});
