// test/lobby.test.js — prompt 149: the join screen's live data. s_lobby
// broadcasts team head-counts + server config on connection and every
// seat change; fresh joins are refused at a 2-human imbalance (token
// reclaims exempt); spectate honours the server config.
import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createAppServer } from "../server/index.js";

const settle = (ms = 50) => new Promise((r) => setTimeout(r, ms));
async function until(cond, ms = 2000) {
  const t0 = Date.now();
  while (!cond() && Date.now() - t0 < ms) await settle(20);
  return cond();
}
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
const lastLobby = (c) => [...c.messages].reverse().find((m) => m.type === "s_lobby");

test("149: s_lobby arrives on connection and updates on every join", async () => {
  await withServer({}, async (app, port) => {
    const a = await connect(port);
    assert.ok(await until(() => lastLobby(a)), "lobby on connect");
    assert.deepEqual(lastLobby(a).humans, [0, 0]);
    assert.equal(lastLobby(a).spectate, true);
    a.ws.send(JSON.stringify({ type: "c_join", team: 0, playerId: "p1" }));
    await until(() => lastLobby(a)?.humans?.[0] === 1);
    const b = await connect(port);
    await until(() => lastLobby(b)?.humans?.[0] === 1);
    assert.deepEqual(lastLobby(b).humans, [1, 0], "a waiting socket sees live counts");
    a.ws.close(); b.ws.close();
  });
});

test("149: a 2-human imbalance refuses fresh joins; reclaims still land", async () => {
  await withServer({}, async (app, port) => {
    const socks = [];
    for (let i = 0; i < 2; i++) {
      const c = await connect(port);
      c.ws.send(JSON.stringify({ type: "c_join", team: 0, playerId: `a${i}` }));
      socks.push(c);
    }
    await until(() => lastLobby(socks[1])?.humans?.[0] === 2);
    const late = await connect(port);
    late.ws.send(JSON.stringify({ type: "c_join", team: 0, playerId: "late" }));
    await until(() => late.messages.some((m) => m.type === "s_rejected"));
    assert.equal(late.messages.find((m) => m.type === "s_rejected").reason, "team full");
    // The SAME player who already owns a team-0 seat reclaims fine.
    socks[0].ws.close();
    await settle(80);
    const back = await connect(port);
    back.ws.send(JSON.stringify({ type: "c_join", team: 0, playerId: "a0" }));
    assert.ok(await until(() => back.messages.some((m) => m.type === "s_joined")),
      "reclaim is exempt from the balance gate");
    for (const c of [ ...socks, late, back]) c.ws.close();
  });
});

test("149: SPECTATE off refuses the booth; REPLAYS off closes the archive", async () => {
  await withServer({ spectate: false, replays: false }, async (app, port) => {
    const c = await connect(port);
    await until(() => lastLobby(c));
    assert.equal(lastLobby(c).spectate, false);
    assert.equal(lastLobby(c).replays, false);
    c.ws.send(JSON.stringify({ type: "c_spectate" }));
    await until(() => c.messages.some((m) => m.type === "s_rejected"));
    assert.equal(c.messages.find((m) => m.type === "s_rejected").reason, "spectating disabled");
    const res = await fetch(`http://localhost:${port}/replays`);
    assert.equal(res.status, 403);
    c.ws.close();
  });
});
