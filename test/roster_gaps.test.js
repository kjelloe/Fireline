// test/roster_gaps.test.js — roster consolidation gaps after the Logistics
// Truck slice: chassis contract completeness, AI doctrine boundaries, reserve
// fielding, and a ws-level truck rescue. Guards the checklist the
// `new-chassis` skill encodes (Command Carrier, Sentinel, drone... are coming).

import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { UNIT_STATS, getUnitStats, UNIT_LOGISTICS } from "../engine/units.js";
import { GameServer } from "../engine/server.js";
import { createAppServer } from "../server/index.js";
import { createInitialState } from "../engine/state.js";
import { chassisName } from "../client/js/asset_resolver.js";

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

test("roster unit: every chassis states its full contract explicitly", () => {
  for (const [type, stats] of Object.entries(UNIT_STATS)) {
    for (const field of ["speed", "range", "minRange", "hp", "damage", "reloadTicks", "turnRate"]) {
      assert.equal(typeof stats[field], "number", `${stats.name}.${field} is a number`);
    }
    assert.equal(typeof stats.indirect, "boolean", `${stats.name}.indirect explicit`);
    assert.equal(typeof stats.canTow, "boolean",
      `${stats.name}.canTow must be explicit — new chassis must declare their tow role`);
    assert.equal(typeof stats.canCarryStandard, "boolean",
      `${stats.name}.canCarryStandard must be explicit (9A)`);
    assert.equal(typeof stats.capacity, "number", `${stats.name}.capacity explicit (9B prep)`);
    assert.notEqual(chassisName(Number(type)), undefined);
  }
  const towers = Object.values(UNIT_STATS).filter((s) => s.canTow);
  assert.deepEqual(towers.map((s) => s.name), ["logistics"],
    "exactly one chassis tows today");
});

test("roster component: each team fields 3 trucks in reserves; ids pinned", () => {
  const s = createInitialState(42, "frontier_corridor");
  const trucks = (team) => s.assets
    .filter((a) => a.team === team && a.type === UNIT_LOGISTICS)
    .map((a) => a.id);
  assert.deepEqual(trucks(0), [9, 15, 17]);
  assert.deepEqual(trucks(1), [21, 27, 29]);
  const carriers = (team) => s.assets
    .filter((a) => a.team === team && a.type === 4)
    .map((a) => a.id);
  assert.deepEqual(carriers(0), [8, 19]);
  assert.deepEqual(carriers(1), [20, 31]);
  // AI regents crew assets 8-11 / 20-23: each team's AI gets a carrier (8/20)
  // and a truck (9/21); one carrier and two trucks sit in the garage.
});

test("roster component: AI doctrine never issues tow orders (towing is human work for now)", () => {
  const server = new GameServer({ mapSeed: 42, enableAi: true, aiDifficulty: 2 });
  server.step();
  // Wreck a few assets near AI units so tow opportunities exist.
  for (const id of [1, 2]) {
    server.state.assets[id].hp = 0;
    server.state.assets[id].state = 2;
  }
  for (let i = 0; i < 200; i++) server.step();
  const tows = server.commandLog.filter((e) => e.cmd.type === "tow_order");
  assert.equal(tows.length, 0, "pinned: AI regency has no tow doctrine yet");
});

test("roster integration: ws truck rescue — select truck, tow, watch it ride home", async () => {
  const appServer = createAppServer({ mapSeed: 42, enableAi: false });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    const ws = new WebSocket(`ws://localhost:${addr.port}`);
    const messages = [];
    ws.on("message", (d) => messages.push(JSON.parse(d)));
    await new Promise((r) => ws.on("open", r));
    ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await settle();
    ws.send(JSON.stringify({ type: "select_asset", assetId: 15 })); // garage truck
    await settle();
    appServer.pump(appServer.gameServer.step());

    // step() replaces gameServer.state — always read through the getter.
    const S = () => appServer.gameServer.state;
    assert.equal(S().assets[15].operatorId, 0, "human crews the truck");

    // Stage a wreck adjacent to the truck (test shortcut), then tow over ws.
    S().assets[0].hp = 0;
    S().assets[0].state = 2;
    S().assets[0].x = S().assets[15].x + 256;
    S().assets[0].y = S().assets[15].y;
    ws.send(JSON.stringify({ type: "tow_order", wreckAssetId: 0 }));
    await settle();
    appServer.pump(appServer.gameServer.step());
    // Both vehicles already stand inside the depot, so the same tick hooks
    // the tow AND hands the wreck to the repair bay (tow line released).
    const types = S().events.map((e) => e.type);
    assert.deepEqual(types, ["tow_started", "recovery_started"],
      "tow chain over the wire in one tick");
    assert.ok(S().assets[0].recoverTimer > 0, "repair bay engaged");
    assert.equal(S().assets[0].towedBy, -1, "tow released at the depot");

    const view = messages.filter((m) => m.type === "s_snapshot").at(-1)?.view;
    assert.ok(view.friendlyAssets.some((a) => a.id === 0 && a.recoverTimer >= 0),
      "recovery state visible to the owner");
    ws.close();
  } finally {
    await appServer.stop();
  }
});

test("roster integration: a tank ordering a tow over ws gets the teaching rejection", async () => {
  const appServer = createAppServer({ mapSeed: 42, enableAi: false });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    const ws = new WebSocket(`ws://localhost:${addr.port}`);
    const messages = [];
    ws.on("message", (d) => messages.push(JSON.parse(d)));
    await new Promise((r) => ws.on("open", r));
    ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await settle();
    ws.send(JSON.stringify({ type: "select_asset", assetId: 0 })); // tank
    await settle();
    appServer.pump(appServer.gameServer.step());

    appServer.gameServer.state.assets[1].hp = 0;
    appServer.gameServer.state.assets[1].state = 2;
    ws.send(JSON.stringify({ type: "tow_order", wreckAssetId: 1 }));
    await settle();
    appServer.pump(appServer.gameServer.step());
    await settle();

    const rejection = messages.filter((m) => m.type === "s_snapshot")
      .flatMap((m) => m.view.events)
      .find((e) => e.type === "rejected" && e.cmd === "tow_order");
    assert.equal(rejection?.reason, "needs a logistics truck");
  } finally {
    await appServer.stop();
  }
});
