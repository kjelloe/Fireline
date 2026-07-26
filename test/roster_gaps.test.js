// test/roster_gaps.test.js — roster consolidation gaps after the Logistics
// Truck slice: chassis contract completeness, AI doctrine boundaries, reserve
// fielding, and a ws-level truck rescue. Guards the checklist the
// `new-chassis` skill encodes (Command Carrier, Sentinel, drone... are coming).

import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { UNIT_STATS, getUnitStats, UNIT_LOGISTICS } from "../engine/units.js";
import { apply } from "../engine/reducer.js";
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

test("roster component: AI trucks tow wrecks home (11E full AI rescue play, Q5)", () => {
  // The pre-11E pin ("towing is human work") was overruled by ruling Q5:
  // full AI rescue play, sim-gated. The doctrine hauls claimable wrecks.
  const server = new GameServer({ mapSeed: 42, enableAi: true, aiDifficulty: 2 });
  server.step();
  for (const id of [1, 2]) {
    server.state.assets[id].hp = 0;
    server.state.assets[id].state = 2;
  }
  for (let i = 0; i < 400; i++) server.step();
  const tows = server.commandLog.filter((e) => e.cmd.type === "tow_order");
  assert.ok(tows.length >= 1, "the AI truck hooks a nearby wreck");
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

test("roster component: every fielded chassis is selectable and drivable (11R/11S garage sweep)", () => {
  // Roster mistakes (a type with no stats, a garage unit that rejects
  // selection) should fail HERE, not in a playtest garage.
  const s0 = createInitialState(42, "frontier_corridor");
  const types = [...new Set(s0.assets.map((a) => a.type))].sort();
  assert.deepEqual(types, [0, 1, 2, 3, 4, 5, 6], "seven chassis fielded");
  for (const type of types) {
    const asset = s0.assets.find((a) => a.type === type && a.team === 0 && a.operatorId === -1);
    assert.ok(asset, `type ${type} has a free team-0 unit`);
    let s = createInitialState(42, "frontier_corridor");
    s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
    s = apply(s, { type: "select_asset", operatorId: 0, assetId: asset.id, confirm: true });
    assert.equal(s.assets[asset.id].operatorId, 0, `type ${type} selectable`);
    s = apply(s, { type: "drive", operatorId: 0, throttle: 1, turn: 0 });
    const x0 = s.assets[asset.id].x;
    s = apply(s, { type: "advance_tick" });
    assert.ok(s.assets[asset.id].x !== x0, `type ${type} drives`);
  }
});

test("roster integration: the drive command works over the wire (11L ws gap)", async () => {
  const appServer = createAppServer({ mapSeed: 42, enableAi: false });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    const ws = new WebSocket(`ws://localhost:${addr.port}`);
    const messages = [];
    ws.on("message", (d) => messages.push(JSON.parse(d)));
    await new Promise((r) => ws.on("open", r));
    ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await new Promise((r) => setTimeout(r, 60));
    appServer.gameServer.step();
    ws.send(JSON.stringify({ type: "select_asset", assetId: 0, confirm: true }));
    await new Promise((r) => setTimeout(r, 60));
    appServer.gameServer.step();
    ws.send(JSON.stringify({ type: "drive", throttle: 1, turn: 0 }));
    await new Promise((r) => setTimeout(r, 60));
    const x0 = appServer.gameServer.state.assets[0].x;
    appServer.gameServer.step();
    appServer.gameServer.step();
    assert.ok(appServer.gameServer.state.assets[0].x > x0, "the wheel turns over ws");
    ws.close();
  } finally {
    await appServer.stop();
  }
});

test("11J ops: /version reports provenance; command floods are rate limited", async () => {
  const appServer = createAppServer({ mapSeed: 42, enableAi: false });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    const version = await (await fetch(`http://localhost:${addr.port}/version`)).json();
    assert.equal(version.name, "more-firepower");
    assert.ok(version.fixtureVersion >= 30, "fixture provenance exposed");
    assert.equal(version.mapProfile, "frontier_corridor");

    const ws = new WebSocket(`ws://localhost:${addr.port}`);
    const messages = [];
    ws.on("message", (d) => messages.push(JSON.parse(d)));
    await new Promise((r) => ws.on("open", r));
    ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await new Promise((r) => setTimeout(r, 60));
    // Flood far past the burst budget in one instant.
    for (let i = 0; i < 200; i++) {
      ws.send(JSON.stringify({ type: "move_order", targetCellX: 1, targetCellY: 1, seq: i }));
    }
    // Load-tolerant: the bucket REFILLS while the suite starves the event
    // loop, so fixed thresholds lie. The property: a 200-command flood is
    // substantially rejected, and accepted + rejected accounts for it all.
    const t0 = Date.now();
    let limited = [];
    while (Date.now() - t0 < 4000) {
      limited = messages.filter((m) => m.type === "s_rejected" && m.reason === "rate limited");
      if (limited.length + appServer.gameServer.queue.length >= 200) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.ok(limited.length >= 50,
      `flood substantially rejected (${limited.length} limited)`);
    assert.ok(appServer.gameServer.queue.length <= 200 - limited.length + 2,
      "every command is either queued or rejected, never both");
    ws.close();
  } finally {
    await appServer.stop();
  }
});
