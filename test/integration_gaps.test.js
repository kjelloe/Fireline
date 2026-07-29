// test/integration_gaps.test.js — integration gaps: post-rejoin control,
// ws-level game over, crash recovery from the command log, and a long-war
// state invariant sweep.

import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createAppServer } from "../server/index.js";
import { GameServer } from "../engine/server.js";
import { createInitialState, apply } from "../engine/reducer.js";
import { replayLog } from "../engine/replay.js";
import { hashState } from "../engine/snapshot.js";
import { cellToWorld } from "../shared/fixedmath.js";

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

test("integration: a rejoined player actually drives their old asset", async () => {
  await withServer({}, async (appServer, port) => {
    const a = await connect(port);
    a.ws.send(JSON.stringify({ type: "c_join", team: 0, playerId: "pilot-1" }));
    await settle();
    a.ws.send(JSON.stringify({ type: "select_asset", assetId: 0 }));
    await settle();
    appServer.gameServer.step();
    a.ws.close();
    await settle();

    const b = await connect(port);
    b.ws.send(JSON.stringify({ type: "c_join", team: 0, playerId: "pilot-1" }));
    await settle();
    b.ws.send(JSON.stringify({ type: "move_order", targetCellX: 20, targetCellY: 56 }));
    await settle();
    appServer.gameServer.step();
    assert.equal(appServer.gameServer.state.assets[0].x, cellToWorld(7) + 32,
      "post-rejoin orders drive the same asset");
    b.ws.close();
  });
});

test("integration: game over reaches ws clients and post-war joins are refused", async () => {
  await withServer({}, async (appServer, port) => {
    const a = await connect(port);
    a.ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await settle();
    // End the war server-side: wreck every fielded team-1 asset.
    for (const asset of appServer.gameServer.state.assets) {
      if (asset.team === 1) { asset.hp = 0; asset.state = 2; }
    }
    appServer.transport.broadcastSnapshots(appServer.gameServer.step());
    await settle();
    const snap = a.messages.filter((m) => m.type === "s_snapshot").at(-1);
    assert.ok(snap.view.events.some((e) => e.type === "game_over"), "clients see the horn");
    assert.equal(snap.view.phase, 1);
    assert.equal(snap.view.winner, 0);

    const b = await connect(port);
    b.ws.send(JSON.stringify({ type: "c_join", team: 1 }));
    await settle();
    appServer.transport.broadcastSnapshots(appServer.gameServer.step());
    await settle();
    const joinedB = b.messages.find((m) => m.type === "s_joined");
    assert.ok(joinedB, "transport accepts the socket");
    const rejectedEvent = b.messages
      .filter((m) => m.type === "s_snapshot")
      .flatMap((m) => m.view.events)
      .find((e) => e.type === "rejected" && e.cmd === "join_operator");
    assert.ok(rejectedEvent, "reducer refuses joining a finished war");
    assert.equal(rejectedEvent.reason, "war is over");
    a.ws.close(); b.ws.close();
  });
});

test("integration: a crashed server rebuilds exact state from its command log", () => {
  const original = new GameServer({ mapSeed: 7, enableAi: true });
  original.enqueue({ type: "join_operator", operatorId: 0, team: 0 });
  original.enqueue({ type: "select_asset", operatorId: 0, assetId: 12 });
  for (let i = 0; i < 40; i++) {
    if (i === 10) original.enqueue({ type: "move_order", operatorId: 0, targetCellX: 32, targetCellY: 63 });
    original.step();
  }
  const diedAtHash = original.getLatestSnapshot().stateHash;
  const log = structuredClone(original.commandLog); // what a store would hold

  // "Restart": rebuild from initial state + log, then both continue in lockstep.
  const rebuilt = replayLog(createInitialState(7, "frontier_corridor"), log);
  assert.equal(hashState(rebuilt), diedAtHash);

  let a = rebuilt;
  original.step();
  // Continue the rebuilt state with the same commands the live server ran.
  for (const entry of original.commandLog.slice(log.length)) {
    a = apply(a, entry.cmd);
  }
  assert.equal(hashState(a), original.getLatestSnapshot().stateHash,
    "rebuilt war continues identically");
});

test("integration: 4000-tick AI war upholds state invariants", () => {
  const server = new GameServer({ mapSeed: 1234, enableAi: true, aiDifficulty: 2 });
  for (let i = 0; i < 4000; i++) server.step();
  const s = server.state;
  const map = s.map;
  for (const a of s.assets) {
    for (const field of ["x", "y", "targetX", "targetY", "hp", "ammo", "fuel", "suppressedTimer"]) {
      assert.equal(Number.isInteger(a[field]), true, `asset ${a.id} ${field} integer`);
    }
    assert.ok(a.hp >= 0 && a.ammo >= 0 && a.fuel >= 0, `asset ${a.id} non-negative pools`);
    assert.ok(a.x >= 0 && a.x < map.width * 256, `asset ${a.id} x in bounds`);
    assert.ok(a.y >= 0 && a.y < map.height * 256, `asset ${a.id} y in bounds`);
  }
  for (const o of s.operators) {
    if (o.assetId !== -1) {
      assert.equal(s.assets[o.assetId].operatorId, o.id, `operator ${o.id} link symmetric`);
    }
  }
  for (const site of s.sites) assert.ok([-1, 0, 1].includes(site.owner));
  assert.ok(s.teamScores.every((v) => Number.isInteger(v) && v >= 0));
  // And the whole thing still replays.
  const rebuilt = replayLog(createInitialState(1234, "frontier_corridor"), server.commandLog);
  assert.equal(hashState(rebuilt), server.getLatestSnapshot().stateHash);
});

// 13E: the ONE over-the-wire test the new command shape owes. The
// transport spreads operatorId onto the command, and a validate() shape
// bug hides exactly there - a bridge target that works in-process can
// still be refused (or worse, silently accepted for the wrong operator)
// once it crosses the socket.
test("integration: fire_order at a bridge crosses the wire and is enforced", async () => {
  await withServer({ mapSeed: 2026, mapProfile: "riverline" }, async (appServer, port) => {
    const a = await connect(port);
    a.ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await settle(80);
    // Crew asset 0 and make it an artillery piece parked by the middle
    // span, supplied, so only the RULES can refuse the shot.
    const st = appServer.gameServer.state;
    const gun = st.assets[0];
    gun.type = 2; // artillery: the only siege chassis
    gun.x = 58 * 256; gun.y = 63 * 256;
    gun.ammo = 20; gun.fuel = 4000; gun.reloadTimer = 0;
    st.bases = [
      { team: 0, x: 0, y: 0, width: st.map.width, height: st.map.height },
      { team: 1, x: 0, y: 0, width: st.map.width, height: st.map.height },
    ];
    a.ws.send(JSON.stringify({ type: "select_asset", assetId: 0, confirm: true }));
    await settle(80);

    const before = appServer.gameServer.state.bridges[1].hp;
    a.ws.send(JSON.stringify({ type: "fire_order", targetBridgeId: 1 }));
    await settle(120);
    // withServer runs the clock stubbed out, so queued commands only
    // reach the reducer when we step it by hand.
    appServer.gameServer.step();
    const after = appServer.gameServer.state.bridges[1].hp;
    const refusals = a.messages.filter((m) => m.type === "s_rejected").map((m) => m.reason);
    assert.ok(after < before,
      `the shell landed over the wire (${before} -> ${after}); refusals: ${JSON.stringify(refusals)}`);

    // And the siege rule survives the transport: a bridge id no map has
    // is refused rather than crashing or silently doing nothing odd.
    a.ws.send(JSON.stringify({ type: "fire_order", targetBridgeId: 99 }));
    await settle(120);
    appServer.gameServer.step();
    assert.equal(appServer.gameServer.state.bridges.length, 3, "no phantom bridge appeared");
    a.ws.close();
  });
});
