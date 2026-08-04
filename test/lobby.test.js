// test/lobby.test.js — prompt 149: the join screen's live data. s_lobby
// broadcasts team head-counts + server config on connection and every
// seat change; the 2-human balance gate is OPT-IN since W4-1 (Q77 —
// friends stack a team by default, the Regency holds the other side);
// token reclaims are always exempt; spectate honours the server config.
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

test("149/W4-1: with the gate ON, a 2-human imbalance refuses fresh joins; reclaims still land", async () => {
  await withServer({ teamBalance: true }, async (app, port) => {
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

test("W4-1 (Q77): the default war lets friends stack one team, and says so in s_lobby", async () => {
  await withServer({}, async (app, port) => {
    const socks = [];
    for (let i = 0; i < 3; i++) {
      const c = await connect(port);
      c.ws.send(JSON.stringify({ type: "c_join", team: 0, playerId: `s${i}` }));
      socks.push(c);
    }
    assert.ok(await until(() => lastLobby(socks[2])?.humans?.[0] === 3),
      "three humans stacked team 0 with zero on team 1");
    assert.equal(socks.every((c) => c.messages.some((m) => m.type === "s_joined")), true,
      "nobody was refused");
    assert.equal(lastLobby(socks[2]).balance, false,
      "s_lobby tells the client the gate is off (no greying)");
    for (const c of socks) c.ws.close();
  });
  await withServer({ teamBalance: true }, async (app, port) => {
    const c = await connect(port);
    assert.ok(await until(() => lastLobby(c) !== undefined), "lobby arrives");
    assert.equal(lastLobby(c).balance, true, "competitive hosts advertise the gate");
    c.ws.close();
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

test("O2: names ride the join and land in everyone's lobby packet", async () => {
  await withServer({}, async (app, port) => {
    const a = await connect(port);
    a.ws.send(JSON.stringify({ type: "c_join", team: 0, playerId: "n1", name: "Kjell" }));
    await until(() => a.messages.some((m) => m.type === "s_joined"));
    const opId = a.messages.find((m) => m.type === "s_joined").operatorId;
    const b = await connect(port);
    assert.ok(await until(() => lastLobby(b)?.names?.[opId] === "Kjell"),
      "a waiting socket sees the name");
    a.ws.close(); b.ws.close();
  });
});

test("O5: the autosave roundtrip preserves the state hash exactly", async () => {
  const { createInitialState } = await import("../engine/state.js");
  const { apply } = await import("../engine/reducer.js");
  const { hashState } = await import("../engine/snapshot.js");
  let s = createInitialState(2026, "frontier_corridor", {});
  for (let i = 0; i < 50; i++) s = apply(s, { type: "advance_tick" });
  const body = JSON.stringify({ savedAt: 1, state: s },
    (k, v) => (v instanceof Uint8Array ? { __u8: Array.from(v) } : v));
  const back = JSON.parse(body, (k, v) => (v && v.__u8 ? Uint8Array.from(v.__u8) : v)).state;
  assert.equal(hashState(back), hashState(s), "byte-identical war after the roundtrip");
  const s2 = apply(back, { type: "advance_tick" });
  assert.equal(typeof s2.tick, "number", "the revived war ticks");
});

test("O4: the lobby packet carries the host's AI difficulty", async () => {
  await withServer({ aiDifficulty: 2 }, async (app, port) => {
    const c = await connect(port);
    assert.ok(await until(() => lastLobby(c) !== undefined), "lobby arrives");
    assert.equal(lastLobby(c).difficulty, 2, "hard reaches the join screen");
    c.ws.close();
  });
  await withServer({}, async (app, port) => {
    const c = await connect(port);
    assert.ok(await until(() => lastLobby(c) !== undefined), "lobby arrives");
    assert.equal(lastLobby(c).difficulty, 1, "normal is the default");
    c.ws.close();
  });
});

test("O4: --difficulty accepts names and numbers, numbers stay valid", async () => {
  const { resolveDifficulty } = await import("../server/index.js");
  assert.equal(resolveDifficulty("easy"), 0);
  assert.equal(resolveDifficulty("Normal"), 1);
  assert.equal(resolveDifficulty("HARD"), 2);
  assert.equal(resolveDifficulty("2"), 2);
  assert.equal(resolveDifficulty(null), 1, "unset means normal");
});
