// test/phase8_gaps.test.js — post-Phase-8 gap coverage: mechanic interplay,
// lifecycle edges, and standard-war determinism. Unit → component → integration.

import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { apply, createInitialState } from "../engine/reducer.js";
import { STD_AT_BASE, STD_CARRIED, STD_DROPPED } from "../engine/standards.js";
import { ASSET_MOVING, ASSET_DISABLED } from "../engine/state.js";
import { hashState } from "../engine/snapshot.js";
import { replayLog } from "../engine/replay.js";
import { GameServer } from "../engine/server.js";
import { createAppServer } from "../server/index.js";
import { PHASE_OVER, WIN_STANDARD } from "../engine/victory.js";
import { sandbox, joinAndSelect } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

// ── unit ──────────────────────────────────────────────────────────────────────

test("phase8 unit: roles are exclusive — trucks tow, carriers carry (9A)", () => {
  // Tow+carry stacking died with 9A: the truck cannot take a standard and the
  // carrier cannot tow. Pin both exclusions and the carrier carrying penalty.
  let s = sandbox(
    [
      { team: 0, cellX: 10, type: 3, state: ASSET_MOVING, targetX: cellToWorld(40) }, // truck
      { team: 0, cellX: 12, type: 4, state: ASSET_MOVING, targetX: cellToWorld(40), cellY: 4 }, // carrier
      { team: 0, cellX: 11, state: ASSET_DISABLED, hp: 0 }, // wreck
    ],
    [],
    {
      bases: [{ team: 0, x: 0, y: 20, width: 64, height: 44 }],
      standards: [{ team: 0, cellX: 1, status: STD_DROPPED }, { team: 1, cellX: 10 }],
    }
  );
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.standards[1].status, STD_AT_BASE,
    "truck stood on the enemy standard and could NOT take it");

  s = joinAndSelect(s, 0, 0, 1); // human takes the carrier
  const rejected = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: 2 });
  assert.equal(rejected.events[0].reason, "needs a logistics truck", "carrier cannot tow");

  // Carrier carrying penalty: 24 * 0.75 = 18.
  s.standards[1].x = s.assets[1].x;
  s.standards[1].y = s.assets[1].y;
  s = apply(s, { type: "advance_tick" }); // carrier picks up
  assert.equal(s.standards[1].carrierAssetId, 1);
  const x0 = s.assets[1].x;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[1].x - x0, 18, "carrier 24 * 0.75 = 18");
});

// ── component ─────────────────────────────────────────────────────────────────

test("phase8 component: two enemies on the standard, lowest asset id wins the grab", () => {
  let s = sandbox(
    [{ team: 0, cellX: 10, type: 4 }, { team: 0, cellX: 10, type: 4 }],
    [], { standards: [{ team: 0, cellX: 1, status: STD_DROPPED }, { team: 1, cellX: 10 }] }
  );
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.standards[1].carrierAssetId, 0, "stable asset order decides");
  assert.equal(s.events.filter((e) => e.type === "standard_taken").length, 1,
    "one grab, no double-take");
});

test("phase8 component: disabling a towing truck cuts the line; disabling a carrier drops the flag", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 10, type: 3, hp: 20 },              // truck towing
      { team: 0, cellX: 11, state: ASSET_DISABLED, hp: 0 }, // wreck in tow
      { team: 1, cellX: 12 },                                // gunner
      { team: 0, cellX: 14, type: 4, hp: 20 },               // carrier w/ flag
    ],
    [], { standards: [{ team: 0, cellX: 1, status: STD_DROPPED }, { team: 1, cellX: 14 }] }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: 1 });
  s = apply(s, { type: "advance_tick" }); // tow attach + carrier pickup
  assert.equal(s.standards[1].carrierAssetId, 3);
  s = joinAndSelect(s, 1, 1, 2);
  s = apply(s, { type: "fire_order", operatorId: 1, targetAssetId: 0 });
  assert.equal(s.assets[1].towedBy, -1, "tow line cut");
  for (let i = 0; i < 15; i++) s = apply(s, { type: "advance_tick" }); // reload
  s = apply(s, { type: "fire_order", operatorId: 1, targetAssetId: 3 });
  assert.equal(s.standards[1].status, STD_DROPPED, "flag hits the dirt");
});

test("phase8 component: resetWar clears queue, log, snapshots; fresh board", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true });
  server.enqueue({ type: "join_operator", operatorId: 0, team: 0 });
  for (let i = 0; i < 5; i++) server.step();
  server.enqueue({ type: "move_order", operatorId: 0, targetCellX: 20, targetCellY: 56 }); // queued, unapplied
  server.resetWar(777);
  assert.equal(server.queue.length, 0, "mid-flight commands dropped");
  assert.equal(server.commandLog.length, 0);
  assert.equal(server.snapshots.length, 0);
  assert.equal(server.state.mapSeed, 777);
  assert.equal(server.state.tick, 0);
  assert.ok(server.state.standards.every((st) => st.status === STD_AT_BASE));
  assert.ok(server.state.assets.every((a) => a.operatorId === -1));
  assert.equal(
    hashState(server.state), hashState(createInitialState(777, "frontier_corridor")),
    "reset war is byte-identical to a fresh one"
  );
});

test("phase8 component: postgame countdown fires the reset exactly on time", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mf-count-"));
  const appServer = createAppServer({ mapSeed: 42, enableAi: false, replayDir: dir, postgameTicks: 3 });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    for (const a of appServer.gameServer.state.assets) {
      if (a.team === 1) { a.hp = 0; a.state = 2; }
    }
    appServer.pump(appServer.gameServer.step()); // game over lands here
    assert.equal(appServer.gameServer.state.phase, PHASE_OVER);
    appServer.pump(appServer.gameServer.step()); // +1
    appServer.pump(appServer.gameServer.step()); // +2
    assert.equal(appServer.warsStarted, 1, "not yet");
    appServer.pump(appServer.gameServer.step()); // +3 → reset
    assert.equal(appServer.warsStarted, 2, "reset exactly at postgameTicks");
    assert.equal(appServer.gameServer.state.phase, 0);
  } finally {
    await appServer.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── integration ───────────────────────────────────────────────────────────────

test("phase8 integration: standard-capture win over ws, then rotation with standards home", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mf-stdwar-"));
  const appServer = createAppServer({ mapSeed: 42, enableAi: false, replayDir: dir, postgameTicks: 3 });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    const ws = new WebSocket(`ws://localhost:${addr.port}`);
    const messages = [];
    ws.on("message", (d) => messages.push(JSON.parse(d)));
    await new Promise((r) => ws.on("open", r));
    ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await settle();
    ws.send(JSON.stringify({ type: "select_asset", assetId: 19 })); // garage carrier
    await settle();
    appServer.pump(appServer.gameServer.step());

    // Test shortcut: park the raider on the enemy standard's cell...
    const server = appServer.gameServer;
    const enemyStd = server.state.standards[1];
    server.state.assets[19].x = enemyStd.x;
    server.state.assets[19].y = enemyStd.y;
    appServer.pump(server.step()); // pickup
    assert.equal(server.state.standards[1].status, STD_CARRIED);
    // ...then teleport the carrier to the home zone edge; the carried
    // standard syncs in the movement pass, scoring gate checks the carrier.
    server.state.assets[19].x = cellToWorld(14);
    server.state.assets[19].y = cellToWorld(59);
    appServer.pump(server.step()); // score → game over
    assert.equal(server.state.phase, PHASE_OVER);
    assert.equal(server.state.winReason, WIN_STANDARD);
    await settle();
    const overSnap = messages.filter((m) => m.type === "s_snapshot")
      .find((m) => m.view.events.some((e) => e.type === "standard_scored"));
    assert.ok(overSnap, "the scoring tick reached the client");

    for (let i = 0; i < 4; i++) appServer.pump(server.step()); // postgame → reset
    await settle();
    assert.ok(messages.some((m) => m.type === "s_war_reset"), "rotation announced");
    assert.ok(server.state.standards.every((st) => st.status === STD_AT_BASE),
      "fresh war, both standards home");
    assert.equal(server.state.operators[0].state, 1, "player carried over");
    ws.close();
  } finally {
    await appServer.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("phase8 integration: a pure-command standard raid replays hash-exactly", () => {
  const build = () => {
    const s = sandbox(
      [{ team: 0, cellX: 3, cellY: 1, type: 4 }],
      [],
      {
        bases: [{ team: 0, x: 0, y: 0, width: 4, height: 4 }, { team: 1, x: 20, y: 0, width: 4, height: 4 }],
        standards: [{ team: 0, cellX: 1, cellY: 1 }, { team: 1, cellX: 21, cellY: 1 }],
      }
    );
    return s;
  };
  const log = [];
  const record = (tick, cmd) => { log.push({ tick, cmd }); return cmd; };

  let s = build();
  s = apply(s, record(s.tick, { type: "join_operator", operatorId: 0, team: 0 }));
  s = apply(s, record(s.tick, { type: "select_asset", operatorId: 0, assetId: 0 }));
  s = apply(s, record(s.tick, { type: "move_order", operatorId: 0, targetCellX: 21, targetCellY: 1 }));
  for (let i = 0; i < 350; i++) s = apply(s, record(s.tick, { type: "advance_tick" }));
  s = apply(s, record(s.tick, { type: "move_order", operatorId: 0, targetCellX: 1, targetCellY: 1 }));
  for (let i = 0; i < 500 && s.phase === 0; i++) s = apply(s, record(s.tick, { type: "advance_tick" }));

  assert.equal(s.phase, PHASE_OVER, "raid completed the war");
  assert.equal(s.winReason, WIN_STANDARD);
  const replayed = replayLog(build(), log);
  assert.equal(hashState(replayed), hashState(s), "full raid replays byte-exactly");
});

test("phase8 integration: 3000-tick hard-AI war upholds standard invariants", () => {
  const server = new GameServer({ mapSeed: 55, enableAi: true, aiDifficulty: 2 });
  for (let i = 0; i < 3000; i++) {
    server.step();
    for (const st of server.state.standards) {
      assert.ok([0, 1, 2, 3].includes(st.status), "valid status");
      if (st.status === STD_CARRIED) {
        const carrier = server.state.assets[st.carrierAssetId];
        assert.ok(carrier, "carrier exists");
        assert.notEqual(carrier.team, st.team, "only enemies carry a standard");
        assert.notEqual(carrier.state, ASSET_DISABLED, "wrecks never carry");
      } else {
        assert.equal(st.carrierAssetId, -1, "no stale carrier link");
      }
    }
  }
  const replayed = replayLog(createInitialState(55, "frontier_corridor"), server.commandLog);
  assert.equal(hashState(replayed), server.getLatestSnapshot().stateHash);
});
