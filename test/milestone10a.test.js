// test/milestone10a.test.js — Slice 10A (plan 2.1, slim): spectator role.
// A fog-free, read-only ws seat: sees every asset with full telemetry, both
// teams' downed/mines/pings — and cannot say or do anything.

import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createAppServer } from "../server/index.js";
import { buildSpectatorView, buildView } from "../engine/view.js";
import { apply } from "../engine/reducer.js";
import { sandbox, joinAndSelect } from "./helpers.js";

function connect(port) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const messages = [];
  ws.on("message", (data) => messages.push(JSON.parse(data)));
  return new Promise((resolve) => ws.on("open", () => resolve({ ws, messages })));
}

const settle = (ms = 50) => new Promise((r) => setTimeout(r, ms));
// Load-tolerant wait (the ws-test rule: poll, never trust one settle).
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

test("10A the spectator view is omniscient and player-shaped", () => {
  let s = sandbox(
    [{ team: 0, cellX: 10 }, { team: 1, cellX: 50, type: 4 }],
    [],
    { bases: [
      { team: 0, x: 0, y: 60, width: 4, height: 4 },
      { team: 1, x: 60, y: 60, width: 4, height: 4 },
    ] }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "deploy_mine", operatorId: 0 });
  s = apply(s, { type: "ping", operatorId: 0, kind: "attack" });

  const spec = buildSpectatorView(s);
  assert.equal(spec.spectator, true);
  assert.equal(spec.team, -1);
  assert.equal(spec.friendlyAssets.length, 2, "both teams ride in friendlyAssets");
  assert.ok(spec.friendlyAssets.every((a) => a.hp !== undefined && a.fuel !== undefined),
    "full telemetry for everyone");
  assert.equal(spec.mines.length, 1, "unmarked mines visible");
  assert.equal(spec.events.some((e) => e.type === "ping"), true,
    "team-scoped pings visible to the booth");
  // The fogged player view still hides what it should (control group).
  assert.equal(buildView(s, 1).mines.length, 0);
});

test("10A ws spectators receive full snapshots and cannot act", async () => {
  await withServer(async (appServer, port) => {
    const player = await connect(port);
    player.ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    const booth = await connect(port);
    booth.ws.send(JSON.stringify({ type: "c_spectate" }));
    await until(() => booth.messages.some((m) => m.type === "s_map"));

    assert.ok(booth.messages.some((m) => m.type === "s_spectating"));
    assert.ok(booth.messages.some((m) => m.type === "s_map"), "terrain shipped once");

    appServer.gameServer.step();
    appServer.transport.broadcastSnapshots(appServer.gameServer.getLatestSnapshot());
    await until(() => booth.messages.some((m) => m.type === "s_snapshot"));
    const snap = booth.messages.filter((m) => m.type === "s_snapshot").at(-1);
    assert.ok(snap, "spectator gets per-tick snapshots");
    assert.equal(snap.view.spectator, true);
    assert.equal(snap.view.friendlyAssets.length, 32, "all 32 assets, both teams");

    // Read-only: any command bounces without touching the war.
    booth.ws.send(JSON.stringify({ type: "move_order", targetCellX: 1, targetCellY: 1, seq: 9 }));
    await until(() => booth.messages.some((m) => m.type === "s_rejected"));
    const bounce = booth.messages.filter((m) => m.type === "s_rejected").at(-1);
    assert.equal(bounce?.reason, "spectators only watch");

    player.ws.close(); booth.ws.close();
  });
});

test("10A spectator disconnect never disturbs operator bookkeeping", async () => {
  await withServer(async (appServer, port) => {
    const booth = await connect(port);
    booth.ws.send(JSON.stringify({ type: "c_spectate" }));
    await settle();
    booth.ws.close();
    await settle();
    // Operator slot 0 must still be freely joinable (no phantom reservation
    // or regency call for operatorId -1).
    const player = await connect(port);
    player.ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await settle();
    const joinedMsg = player.messages.find((m) => m.type === "s_joined");
    assert.equal(joinedMsg?.operatorId, 0);
    player.ws.close();
  });
});
