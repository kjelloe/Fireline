// test/milestone11i.test.js — Slice 11I: war-rotation regression for the
// phase-9/10/11 state. A rotated war must carry NOTHING over: no mines,
// drones, ruins, materiel, camp clocks, manufacture timers, downed bodies,
// passengers, capture progress, or ping cooldowns from the previous war.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PHASE_OVER } from "../engine/victory.js";
import { SITE_HP_MAX } from "../engine/sites.js";
import { MINES_PER_TANK } from "../engine/mines.js";
import { createAppServer } from "../server/index.js";
import { createInitialState } from "../engine/state.js";
import { hashState } from "../engine/snapshot.js";
import { mix32 } from "../shared/prng.js";
import { cellToWorld } from "../shared/fixedmath.js";

test("11I a rotated war starts with a spotless battlefield", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mf-rotation-"));
  const appServer = createAppServer({
    mapSeed: 42, enableAi: false, replayDir: dir, postgameTicks: 5,
  });
  await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    const S = () => appServer.gameServer.state;
    appServer.pump(appServer.gameServer.step());

    // Dirty the war with every phase-9/10/11 system at once.
    const s = S();
    s.mines.push({ id: 9, team: 0, cellX: 50, cellY: 50, armTimer: 0, marked: 1 });
    s.nextMineId = 10;
    s.drones.push({
      id: 4, team: 1, x: cellToWorld(40), y: cellToWorld(40),
      targetAssetId: 0, ageTicks: 5, hitTimer: 2,
    });
    s.nextDroneId = 5;
    s.downed.push({
      operatorId: 5, team: 0, x: cellToWorld(20), y: cellToWorld(20),
      targetX: cellToWorld(20), targetY: cellToWorld(20), downTicks: 10,
    });
    s.operators[5].state = 2; // OP_DOWN
    s.operators[7].lastPingTick = s.tick;
    s.operators[7].autoRescue = 0;
    s.sites[0].hp = 0;                 // a ruin
    s.sites[1].captureProgress = 20;   // a half-flipped flag
    s.sites[1].capturingTeam = 1;
    s.assets[0].minesLeft = 0;
    s.assets[0].campTicks = 250;
    s.assets[9].materiel = 1;
    s.assets[8].aboard1 = 6;           // a passenger mid-rescue
    s.manufacture = [500, 0];

    // Force game over, ride out postgame, rotation fires.
    for (const a of S().assets) {
      if (a.team === 1) { a.hp = 0; a.state = 2; }
    }
    appServer.pump(appServer.gameServer.step());
    assert.equal(S().phase, PHASE_OVER);
    // Ride out postgame and stop EXACTLY at the reset: the rotated state
    // must be inspected at tick 0, before the new war's first tick (which
    // would already, correctly, load truck materiel in base).
    for (let i = 0; i < 20 && appServer.warsStarted < 2; i++) {
      appServer.pump(appServer.gameServer.step());
    }
    assert.equal(appServer.warsStarted, 2, "rotation fired");
    assert.equal(S().tick, 0, "fresh war untouched");

    // The new war is spotless.
    const fresh = S();
    assert.equal(fresh.phase, 0, "new war running");
    assert.equal(fresh.mines.length, 0, "no mines carry over");
    assert.equal(fresh.nextMineId, 0);
    assert.equal(fresh.drones.length, 0, "no drones carry over");
    assert.equal(fresh.nextDroneId, 0);
    assert.equal(fresh.downed.length, 0, "no bodies on the fresh field");
    assert.deepEqual(fresh.manufacture, [0, 0]);
    for (const site of fresh.sites) {
      assert.equal(site.hp, SITE_HP_MAX, "ruins rebuilt");
      assert.equal(site.captureProgress, 0);
      assert.equal(site.capturingTeam, -1);
    }
    for (const a of fresh.assets) {
      assert.equal(a.campTicks, 0);
      assert.equal(a.materiel, 0);
      assert.equal(a.aboard1, -1);
      assert.equal(a.aboard2, -1);
      if (a.type === 0) assert.equal(a.minesLeft, MINES_PER_TANK, "racks refilled");
    }
    for (const o of fresh.operators) {
      assert.equal(o.autoRescue, 1, "options reset with the seat");
      assert.ok(o.lastPingTick < 0, "ping cooldowns cleared");
    }

    // And it is EXACTLY the canonical initial state for the rotated seed.
    assert.equal(
      hashState(fresh),
      hashState(createInitialState(mix32(42), "frontier_corridor")),
      "rotation is byte-identical to a cold start on the new seed"
    );
  } finally {
    await appServer.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
