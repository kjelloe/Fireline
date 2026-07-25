// test/milestone8c.test.js — Milestone 8C: victory integration + war lifecycle.
// Standard capture is the primary victory; after game_over the server runs
// postgame, rotates the seed deterministically, and starts a new war with
// connected players carried over. No restarts, ever.

import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { apply } from "../engine/reducer.js";
import { WIN_STANDARD, PHASE_OVER } from "../engine/victory.js";
import { STD_SCORED, STD_CARRIED } from "../engine/standards.js";
import { mix32 } from "../shared/prng.js";
import { createAppServer } from "../server/index.js";
import { sandbox } from "./helpers.js";

const settle = (ms = 50) => new Promise((r) => setTimeout(r, ms));

test("8C a scored standard ends the war with WIN_STANDARD for the thief", () => {
  let s = sandbox(
    [{ team: 0, cellX: 1, cellY: 1 }],
    [],
    {
      bases: [{ team: 0, x: 0, y: 0, width: 4, height: 4 }],
      standards: [{ team: 0, cellX: 2 }, { team: 1, cellX: 1, cellY: 1 }],
    }
  );
  s = apply(s, { type: "advance_tick" }); // pickup + score + victory, same tick
  assert.equal(s.standards[1].status, STD_SCORED);
  assert.equal(s.phase, PHASE_OVER);
  assert.equal(s.winner, 0);
  assert.equal(s.winReason, WIN_STANDARD);
  const over = s.events.find((e) => e.type === "game_over");
  assert.deepEqual(over, { type: "game_over", winner: 0, reason: WIN_STANDARD });
});

test("8C standard capture outranks elimination as the stated reason", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 1, cellY: 1 },
      { team: 1, cellX: 30, state: 2, hp: 0 }, // team 1 also fully wrecked
    ],
    [],
    {
      bases: [{ team: 0, x: 0, y: 0, width: 4, height: 4 }],
      standards: [{ team: 0, cellX: 2 }, { team: 1, cellX: 1, cellY: 1 }],
    }
  );
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.winReason, WIN_STANDARD, "primary condition wins the narrative");
});

test("8C lifecycle: postgame runs, seed rotates deterministically, players carry over", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mf-lifecycle-"));
  const appServer = createAppServer({
    mapSeed: 42, enableAi: false, replayDir: dir, postgameTicks: 5,
  });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    const ws = new WebSocket(`ws://localhost:${addr.port}`);
    const messages = [];
    ws.on("message", (d) => messages.push(JSON.parse(d)));
    await new Promise((r) => ws.on("open", r));
    ws.send(JSON.stringify({ type: "c_join", operatorId: 2, team: 0 }));
    await settle();
    appServer.pump(appServer.gameServer.step());

    // Force game over: wreck all fielded team-1 assets.
    for (const a of appServer.gameServer.state.assets) {
      if (a.team === 1) { a.hp = 0; a.state = 2; }
    }
    appServer.pump(appServer.gameServer.step());
    assert.equal(appServer.gameServer.state.phase, PHASE_OVER);
    const overTick = appServer.gameServer.state.tick;

    // Postgame: 5 more ticks, then automatic reset.
    for (let i = 0; i < 6; i++) appServer.pump(appServer.gameServer.step());
    await settle();

    const expectedSeed = mix32(42);
    assert.equal(appServer.gameServer.state.mapSeed, expectedSeed, "deterministic rotation");
    assert.equal(appServer.gameServer.state.phase, 0, "new war running");
    assert.ok(appServer.gameServer.state.tick < overTick, "fresh war clock");
    assert.equal(appServer.warsStarted, 2);
    assert.equal(appServer.replayStore.list().length, 1, "old war archived");

    // The connected player was re-joined into the new war on the same slot.
    appServer.pump(appServer.gameServer.step());
    await settle();
    assert.ok(messages.some((m) => m.type === "s_war_reset" && m.mapSeed === expectedSeed));
    assert.equal(messages.filter((m) => m.type === "s_map").length, 2, "new terrain shipped");
    assert.equal(appServer.gameServer.state.operators[2].state, 1, "operator active again");
    assert.equal(appServer.gameServer.state.operators[2].team, 0, "same team");
    ws.close();
  } finally {
    await appServer.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("8C second war is itself archivable and rotates again", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mf-lifecycle2-"));
  const appServer = createAppServer({
    mapSeed: 7, enableAi: false, replayDir: dir, postgameTicks: 2,
  });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    const killTeamOne = () => {
      for (const a of appServer.gameServer.state.assets) {
        if (a.team === 1) { a.hp = 0; a.state = 2; }
      }
    };
    for (let round = 0; round < 2; round++) {
      killTeamOne();
      for (let i = 0; i < 5; i++) appServer.pump(appServer.gameServer.step());
    }
    assert.equal(appServer.warsStarted, 3, "two rotations");
    assert.equal(appServer.replayStore.list().length, 2, "both wars archived");
    assert.equal(appServer.gameServer.state.mapSeed, mix32(mix32(7)));
  } finally {
    await appServer.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
