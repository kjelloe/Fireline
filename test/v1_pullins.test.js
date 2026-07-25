// test/v1_pullins.test.js — v1 pull-ins from phases 5-7:
// 5B playerId reconnect, 6A map-once + trimmed snapshots, 6D AI difficulty,
// 7E graceful shutdown.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { createAppServer } from "../server/index.js";
import { GameServer } from "../engine/server.js";
import { AI_EASY, AI_HARD } from "../engine/ai_regency.js";

const settle = (ms = 50) => new Promise((r) => setTimeout(r, ms));

function connect(port) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const messages = [];
  ws.on("message", (data) => messages.push(JSON.parse(data)));
  return new Promise((resolve) => ws.on("open", () => resolve({ ws, messages })));
}

async function withServer(opts, fn) {
  const appServer = createAppServer({ mapSeed: 42, enableAi: false, ...opts });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try { await fn(appServer, addr.port); } finally { await appServer.stop(); }
}

test("5B same playerId reattaches to its operator and ends regency", async () => {
  await withServer({}, async (appServer, port) => {
    const a = await connect(port);
    a.ws.send(JSON.stringify({ type: "c_join", team: 0, playerId: "kjell-abc" }));
    await settle();
    appServer.gameServer.step();
    const opId = a.messages.find((m) => m.type === "s_joined").operatorId;
    a.ws.close();
    await settle();
    assert.ok(appServer.gameServer.ai.regented.has(opId), "regency assumed on drop");

    const b = await connect(port);
    b.ws.send(JSON.stringify({ type: "c_join", team: 1, playerId: "kjell-abc" })); // team ignored on rejoin
    await settle();
    const rejoined = b.messages.find((m) => m.type === "s_joined");
    assert.equal(rejoined.operatorId, opId, "same slot back");
    assert.equal(rejoined.team, 0, "original team preserved");
    assert.equal(rejoined.rejoined, true);
    assert.equal(appServer.gameServer.ai.regented.has(opId), false, "regency released");
    b.ws.close();
  });
});

test("5B live duplicate playerId is refused", async () => {
  await withServer({}, async (appServer, port) => {
    const a = await connect(port);
    a.ws.send(JSON.stringify({ type: "c_join", team: 0, playerId: "dupe" }));
    await settle();
    const b = await connect(port);
    b.ws.send(JSON.stringify({ type: "c_join", team: 0, playerId: "dupe" }));
    await settle();
    assert.equal(b.messages.find((m) => m.type === "s_rejected").reason, "player already connected");
    a.ws.close(); b.ws.close();
  });
});

test("6A terrain ships once via s_map; snapshots carry no mapCells", async () => {
  await withServer({}, async (appServer, port) => {
    const a = await connect(port);
    a.ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await settle();
    const mapMsg = a.messages.find((m) => m.type === "s_map");
    assert.equal(mapMsg.width, 128);
    assert.equal(mapMsg.mapCells.length, 128 * 128);

    appServer.transport.broadcastSnapshots(appServer.gameServer.step());
    await settle();
    const snap = a.messages.find((m) => m.type === "s_snapshot");
    assert.equal("mapCells" in snap.view, false, "static terrain stripped per tick");
    assert.ok(Array.isArray(snap.view.friendlyAssets));
    a.ws.close();
  });
});

test("6D easy AI fires roughly half as often; hard AI pushes relays", () => {
  const shots = (difficulty) => {
    const server = new GameServer({ mapSeed: 42, enableAi: true, aiDifficulty: difficulty });
    server.step();
    // Stage a shooting gallery inside team A supply: enemy tank parked nearby.
    server.state.assets[4].x = server.state.assets[0].x + 512;
    server.state.assets[4].y = server.state.assets[0].y;
    server.state.assets[4].hp = 10000; // absorb everything; count shots
    for (let i = 0; i < 90; i++) server.step();
    return server.commandLog.filter((e) => e.cmd.type === "fire_order").length;
  };
  const normal = shots(1);
  const easy = shots(AI_EASY);
  assert.ok(easy < normal, `easy (${easy}) must fire less than normal (${normal})`);
  assert.ok(easy >= Math.floor(normal / 2) - 2, "easy is throttled, not absent");

  const hard = new GameServer({ mapSeed: 42, enableAi: true, aiDifficulty: AI_HARD });
  hard.step(); hard.step();
  const moves = hard.commandLog.filter((e) => e.cmd.type === "move_order");
  assert.ok(
    moves.some((m) => [32, 63, 95].includes(m.cmd.targetCellX) && m.cmd.targetCellY === 63),
    "hard difficulty targets relay cells"
  );
});

test("7E graceful shutdown archives the war and notifies clients", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mf-shutdown-"));
  const appServer = createAppServer({ mapSeed: 42, enableAi: true, replayDir: dir });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  const a = await connect(addr.port);
  try {
    a.ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await settle();
    for (let i = 0; i < 5; i++) appServer.gameServer.step();
    await appServer.shutdown();
    await settle();
    assert.ok(a.messages.some((m) => m.type === "s_server_closing"), "clients warned");
    assert.equal(appServer.replayStore.list().length, 1, "unfinished war archived");
    assert.equal(appServer.replayStore.list()[0].reason, 0, "marked unfinished");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
