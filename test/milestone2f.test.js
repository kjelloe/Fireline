// test/milestone2f.test.js — Milestone 2F: vertical slice end-to-end.
// Client protocol → server → engine → fog-filtered views, over real
// WebSockets, plus static serving of the browser client and its vendor libs.
// (DOM/three.js rendering itself is exercised in the browser; the protocol
// and every decision path it relies on are covered here.)

import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createAppServer } from "../server/index.js";
import { buildCommandForClick } from "../client/js/input_mapper.js";
import { createInterpolator } from "../client/js/interpolator.js";

const settle = (ms = 50) => new Promise((r) => setTimeout(r, ms));

function connect(port) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const messages = [];
  ws.on("message", (data) => messages.push(JSON.parse(data)));
  return new Promise((resolve) => ws.on("open", () => resolve({ ws, messages })));
}

const lastSnapshot = (c) => c.messages.filter((m) => m.type === "s_snapshot").at(-1);

test("2F full loop: join, select, converge, fire, wreck visible to both", async () => {
  const appServer = createAppServer({ mapSeed: 42, enableAi: false });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  const port = addr.port;
  const step = async (n = 1) => {
    await settle(30); // let in-flight ws messages reach the server first
    for (let i = 0; i < n; i++) {
      appServer.transport.broadcastSnapshots(appServer.gameServer.step());
    }
    await settle(30);
  };

  try {
    const a = await connect(port);
    const b = await connect(port);
    a.ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    b.ws.send(JSON.stringify({ type: "c_join", team: 1 }));
    await settle();
    a.ws.send(JSON.stringify({ type: "select_asset", assetId: 0 }));
    b.ws.send(JSON.stringify({ type: "select_asset", assetId: 4 }));
    await step();

    assert.equal(lastSnapshot(a).view.visibleEnemies.length, 0, "A starts fogged");
    assert.equal(lastSnapshot(b).view.visibleEnemies.length, 0, "B starts fogged");

    // Teleport the duelists near each other (test shortcut server-side) inside
    // team A's supply umbrella, then drive everything through the protocol.
    appServer.gameServer.state.assets[0].x = 20 * 256;
    appServer.gameServer.state.assets[0].y = 60 * 256;
    appServer.gameServer.state.assets[4].x = 23 * 256;
    appServer.gameServer.state.assets[4].y = 60 * 256;
    await step();

    const viewA = lastSnapshot(a).view;
    assert.equal(viewA.visibleEnemies.length, 1, "A sees the enemy now");

    // Client-side input mapping decides fire vs move — exactly as the browser does.
    const cmd = buildCommandForClick(viewA, 23, 60, { fireRadiusCells: 1 });
    assert.equal(cmd.type, "fire_order");
    for (let volley = 0; volley < 5; volley++) {
      a.ws.send(JSON.stringify(cmd));
      await step(15); // 8E: wait out the tank's reload between volleys
    }

    const finalA = lastSnapshot(a).view;
    const finalB = lastSnapshot(b).view;
    assert.equal(finalA.visibleEnemies[0].state, 2, "A sees the wreck");
    assert.equal(finalB.friendlyAssets.find((x) => x.id === 4).state, 2, "B's asset is disabled");
    assert.equal(finalB.friendlyAssets.find((x) => x.id === 4).hp, 0);

    a.ws.close(); b.ws.close();
  } finally {
    await appServer.stop();
  }
});

test("2F interpolator smooths a real command-driven movement", async () => {
  const appServer = createAppServer({ mapSeed: 42, enableAi: false });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    const a = await connect(addr.port);
    a.ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    await settle();
    a.ws.send(JSON.stringify({ type: "select_asset", assetId: 0 }));
    a.ws.send(JSON.stringify({ type: "move_order", targetCellX: 20, targetCellY: 56 }));
    await settle();

    const interp = createInterpolator({ delayMs: 100 });
    let fakeNow = 0;
    for (let i = 0; i < 3; i++) {
      const snap = appServer.gameServer.step();
      interp.push(snap.views[0], fakeNow);
      fakeNow += 100;
    }
    const sampled = interp.sample(fakeNow - 50); // target lands between snapshots 2 and 3
    const own = sampled.friendlyAssets.find((x) => x.id === 0);
    const start = 7 * 256;
    assert.ok(own.x > start + 16 && own.x < start + 48, `interpolated x=${own.x}`);
    a.ws.close();
  } finally {
    await appServer.stop();
  }
});

test("2F server serves the client and vendored three.js", async () => {
  const appServer = createAppServer({ mapSeed: 1, enableAi: false });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    const page = await fetch(`http://localhost:${addr.port}/`);
    const html = await page.text();
    assert.match(html, /More Firepower/);
    assert.match(html, /\/vendor\/three\/build\/three\.module\.js/);

    const lib = await fetch(`http://localhost:${addr.port}/vendor/three/build/three.module.js`);
    assert.equal(lib.status, 200, "three.js served locally, no CDN");
  } finally {
    await appServer.stop();
  }
});
