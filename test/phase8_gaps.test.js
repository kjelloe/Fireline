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

test("phase8 unit: carrier and tow penalties stack (32 → 24 → 12)", () => {
  // Base rect sits 20 cells south: close enough for supply, far enough that
  // the towed wreck is NOT "at base" (which would start repair and cut the tow).
  let s = sandbox(
    [
      { team: 0, cellX: 10, state: ASSET_MOVING, targetX: cellToWorld(40) },
      { team: 0, cellX: 11, state: ASSET_DISABLED, hp: 0 },
    ],
    [],
    {
      bases: [{ team: 0, x: 0, y: 20, width: 64, height: 44 }],
      standards: [{ team: 0, cellX: 1, status: STD_DROPPED }, { team: 1, cellX: 10 }],
    }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: 1 });
  s = apply(s, { type: "advance_tick" }); // picks up standard while towing
  assert.equal(s.standards[1].status, STD_CARRIED);
  const x0 = s.assets[0].x;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].x - x0, 12, "32 * 0.75 carrier * 0.5 tow = 12");
});

// ── component ─────────────────────────────────────────────────────────────────

test("phase8 component: two enemies on the standard, lowest asset id wins the grab", () => {
  let s = sandbox(
    [{ team: 0, cellX: 10 }, { team: 0, cellX: 10 }],
    [], { standards: [{ team: 0, cellX: 1, status: STD_DROPPED }, { team: 1, cellX: 10 }] }
  );
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.standards[1].carrierAssetId, 0, "stable asset order decides");
  assert.equal(s.events.filter((e) => e.type === "standard_taken").length, 1,
    "one grab, no double-take");
});

test("phase8 component: disabling a tower-carrier drops the flag AND cuts the tow", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 10, hp: 20 },                       // carrier+tower
      { team: 0, cellX: 11, state: ASSET_DISABLED, hp: 0 }, // wreck in tow
      { team: 1, cellX: 12 },                                // gunner
    ],
    [], { standards: [{ team: 0, cellX: 1, status: STD_DROPPED }, { team: 1, cellX: 10 }] }
  );
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: 1 });
  s = apply(s, { type: "advance_tick" }); // pickup
  s = joinAndSelect(s, 1, 1, 2);
  s = apply(s, { type: "fire_order", operatorId: 1, targetAssetId: 0 });
  assert.equal(s.assets[0].state, ASSET_DISABLED);
  assert.equal(s.standards[1].status, STD_DROPPED, "flag hits the dirt");
  assert.equal(s.assets[1].towedBy, -1, "tow line cut");
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
    ws.send(JSON.stringify({ type: "select_asset", assetId: 0 }));
    await settle();
    appServer.pump(appServer.gameServer.step());

    // Test shortcut: park the raider on the enemy standard's cell...
    const server = appServer.gameServer;
    const enemyStd = server.state.standards[1];
    server.state.assets[0].x = enemyStd.x;
    server.state.assets[0].y = enemyStd.y;
    appServer.pump(server.step()); // pickup
    assert.equal(server.state.standards[1].status, STD_CARRIED);
    // ...then teleport the carrier to the home zone edge; the carried
    // standard syncs in the movement pass, scoring gate checks the carrier.
    server.state.assets[0].x = cellToWorld(14);
    server.state.assets[0].y = cellToWorld(59);
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
      [{ team: 0, cellX: 3, cellY: 1 }],
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
