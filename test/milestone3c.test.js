// test/milestone3c.test.js — Milestone 3C: AI regency bot takeover + combat doctrine.
// A dropped human's slot falls to the regency, which pushes for objectives and
// fires under the same rules (fog, supply, range) as everyone else.

import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { GameServer } from "../engine/server.js";
import { AIRegency } from "../engine/ai_regency.js";
import { createAppServer } from "../server/index.js";
import { cellToWorld } from "../shared/fixedmath.js";

const settle = (ms = 50) => new Promise((r) => setTimeout(r, ms));

test("3C regency takes over a dropped operator and pushes for a relay", () => {
  const server = new GameServer({ mapSeed: 42 }); // no fixed AI
  server.enqueue({ type: "join_operator", operatorId: 0, team: 0 });
  server.enqueue({ type: "select_asset", operatorId: 0, assetId: 0 });
  server.step();
  assert.equal(server.state.assets[0].operatorId, 0);

  server.assumeRegency(0);
  server.step();
  const moves = server.commandLog.filter(
    (e) => e.cmd.type === "move_order" && e.cmd.operatorId === 0
  );
  assert.equal(moves.length, 1, "regency issues a move for the dropped slot");
  assert.deepEqual(
    { x: moves[0].cmd.targetCellX, y: moves[0].cmd.targetCellY },
    { x: 32, y: 63 },
    "pushes for the nearest unowned relay"
  );
  assert.equal(server.state.assets[0].state, 1, "asset is moving under regency");
});

test("3C release stops regency commands for that slot", () => {
  const server = new GameServer({ mapSeed: 42 });
  server.enqueue({ type: "join_operator", operatorId: 0, team: 0 });
  server.enqueue({ type: "select_asset", operatorId: 0, assetId: 0 });
  server.step();
  server.assumeRegency(0);
  server.step();
  const before = server.commandLog.filter((e) => e.cmd.operatorId === 0).length;
  server.releaseRegency(0);
  for (let i = 0; i < 5; i++) server.step();
  const after = server.commandLog.filter((e) => e.cmd.operatorId === 0).length;
  assert.equal(after, before, "no further AI commands after release");
});

test("3C AI fires on a visible enemy in range under supply rules", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true });
  server.step(); // AI joins and selects
  // Present a target: drag enemy asset 4 next to AI-run asset 0 inside team
  // A's base supply umbrella.
  server.state.assets[4].x = server.state.assets[0].x + 512;
  server.state.assets[4].y = server.state.assets[0].y;
  server.step();
  const fires = server.commandLog.filter((e) => e.cmd.type === "fire_order");
  assert.ok(fires.length >= 1, "AI engages");
  const hit = server.state.assets[4].hp < 100;
  assert.equal(hit, true, "target took damage");
});

test("3C regency war remains hash-deterministic across runs", () => {
  const run = () => {
    const server = new GameServer({ mapSeed: 7, enableAi: true });
    server.enqueue({ type: "join_operator", operatorId: 2, team: 0 });
    server.enqueue({ type: "select_asset", operatorId: 2, assetId: 2 });
    for (let i = 0; i < 40; i++) {
      if (i === 15) server.assumeRegency(2);
      server.step();
    }
    return server.getLatestSnapshot().stateHash;
  };
  assert.equal(run(), run());
});

test("3C ws disconnect hands the slot to regency", async () => {
  const appServer = createAppServer({ mapSeed: 42, enableAi: false });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    const ws = new WebSocket(`ws://localhost:${addr.port}`);
    await new Promise((r) => ws.on("open", r));
    ws.send(JSON.stringify({ type: "c_join", operatorId: 4, team: 0 }));
    await settle();
    appServer.gameServer.step();
    ws.close();
    await settle();
    assert.ok(appServer.gameServer.ai, "regency exists after disconnect");
    assert.ok(appServer.gameServer.ai.regented.has(4), "slot 4 under regency");
  } finally {
    await appServer.stop();
  }
});

test("3C regented asset without relays holds position", () => {
  const server = new GameServer({ mapSeed: 42 });
  server.state.sites = server.state.sites.map((s) => ({ ...s, owner: 0 })); // team 0 owns all
  server.enqueue({ type: "join_operator", operatorId: 0, team: 0 });
  server.enqueue({ type: "select_asset", operatorId: 0, assetId: 0 });
  server.step();
  server.assumeRegency(0);
  server.step();
  const moves = server.commandLog.filter((e) => e.cmd.type === "move_order");
  assert.equal(moves.length, 0, "nothing left to capture, hold");
});
