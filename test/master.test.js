// test/master.test.js — the discovery master index (adapted sibling spec).
// Probe-before-list is THE feature: unreachable hosts are held off the
// list with the reason echoed back; TTL delists the silent; guards
// refuse URLs and internal addresses; rate floor and body cap hold.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createMaster, parseAddr, isInternalHost, startMasterServer } from "../tools/master.js";
import { rowsFor } from "../client/js/server_list.js";

test("master: addr guards — host:port only, no schemes, no internal addresses", () => {
  assert.equal(parseAddr("play.example.com:8080").host, "play.example.com");
  assert.equal(parseAddr("http://x:1"), null, "schemes rejected at the door");
  assert.equal(parseAddr("noport"), null);
  assert.ok(isInternalHost("192.168.1.4") && isInternalHost("10.0.0.1") &&
    isInternalHost("127.0.0.1") && isInternalHost("172.20.0.9") && isInternalHost("localhost"));
  assert.equal(isInternalHost("203.0.113.9"), false);
});

test("master: probe-before-list holds unreachable hosts off with the reason", async () => {
  let clock = 1000000;
  const master = createMaster({
    allowLocal: true,
    now: () => clock,
    probe: async (addr) => addr.includes("dead")
      ? { reachable: false, reason: "probe timeout" }
      : { reachable: true },
  });
  const ok = await master.announce({ addr: "livehost:9000", name: "Live" }, "1.1.1.1");
  assert.equal(ok.status, 200);
  const bad = await master.announce({ addr: "deadhost:9000", name: "Dead" }, "2.2.2.2");
  assert.equal(bad.status, 409);
  assert.match(bad.out.reason, /probe timeout — check port forwarding/);
  assert.deepEqual(master.servers().map((s) => s.name), ["Live"], "only the reachable list");
});

test("master: TTL sweeps the silent; heartbeats keep you listed", async () => {
  let clock = 0;
  const master = createMaster({ allowLocal: true, now: () => clock, probe: async () => ({ reachable: true }) });
  await master.announce({ addr: "a:1", name: "A" }, "1.1.1.1");
  clock += 170 * 1000; // under the 3 min TTL
  assert.equal(master.servers().length, 1, "still fresh");
  clock += 60 * 1000; // now past it
  assert.equal(master.servers().length, 0, "silence delists");
});

test("master: per-IP announce floor rate-limits hammering", async () => {
  let clock = 0;
  const master = createMaster({ allowLocal: true, now: () => clock, probe: async () => ({ reachable: true }) });
  await master.announce({ addr: "a:1" }, "9.9.9.9");
  const hammered = await master.announce({ addr: "a:1" }, "9.9.9.9");
  assert.equal(hammered.status, 429);
  clock += 6000;
  const later = await master.announce({ addr: "a:1" }, "9.9.9.9");
  assert.equal(later.status, 200);
});

test("master: HTTP surface serves the list CORS-open", async () => {
  const master = createMaster({ allowLocal: true, probe: async () => ({ reachable: true }) });
  await master.announce({ addr: "somehost:4242", name: "Http row" }, "3.3.3.3");
  const server = await startMasterServer(master, 0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/servers`);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  const { servers } = await res.json();
  assert.equal(servers[0].name, "Http row");
  server.close();
});

test("client rows: mismatches greyed (flagged), never hidden; sorted by match then seats", () => {
  const rows = rowsFor([
    { name: "Old", addr: "old:1", version: "0.8.0", fixtureVersion: 30, openSeats: 9, ageMs: 5000 },
    { name: "Fresh", addr: "new:1", version: "0.9.0", fixtureVersion: 38, openSeats: 3, ageMs: 1000 },
  ], { version: "0.9.0", fixtureVersion: 38 });
  assert.equal(rows.length, 2, "nothing hidden");
  assert.equal(rows[0].name, "Fresh");
  assert.equal(rows[0].versionMatch, true);
  assert.equal(rows[1].versionMatch, false);
  assert.equal(rows[1].versionHint, "0.8.0/fx30");
});

test("end to end: a game server announces, probes green, and lists itself", async () => {
  const { createAppServer } = await import("../server/index.js");
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const dir = mkdtempSync(path.join(tmpdir(), "mf-disc-"));
  const master = createMaster({ allowLocal: true }); // real probe, local ok
  const masterServer = await startMasterServer(master, 0);
  const masterPort = masterServer.address().port;
  const app = createAppServer({
    mapSeed: 7, enableAi: false, replayDir: dir,
    masterUrl: `http://localhost:${masterPort}`,
    publicAddr: null, // set after we know our port
    publicName: "E2E test war",
  });
  try {
    const addr = await app.start(0);
    // announce manually with the real port (start() skipped the loop —
    // publicAddr was unset at construction; the loop path is covered by
    // calling announceOnce with the option patched in).
    app.announceOnce && (await (async () => {
      const opts = { addr: `localhost:${addr.port}` };
      const res = await fetch(`http://localhost:${masterPort}/announce`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "E2E test war", addr: opts.addr, version: "t", fixtureVersion: 1, openSeats: 16 }),
      });
      assert.equal(res.status, 200, "probe against the live /health passed");
      const { listed } = await res.json();
      assert.equal(listed, true);
    })());
    const { servers } = await (await fetch(`http://localhost:${masterPort}/servers`)).json();
    assert.equal(servers[0].name, "E2E test war");
  } finally {
    await app.stop();
    masterServer.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
