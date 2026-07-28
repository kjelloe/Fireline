#!/usr/bin/env node
// tools/master.js — the Fireline Command master index (game discovery).
// Adapted from the sibling project's shipped design (specs/game-discovery.md):
// a BULLETIN BOARD, not a broker — game traffic never touches it.
//   Announce: POST /announce {name, addr, version, fixtureVersion, openSeats}
//   List:     GET /servers  (CORS-open; public data)
//   Probe:    before listing and on stale reads, GET http://addr/health
//             (3 s); ANY http response = reachable; refusal = held off
//             the list WITH the reason echoed to the announcer.
// In-memory + TTL — a restart is a non-event (hosts re-announce in <60 s).
//   node tools/master.js --port 8972 [--allow-local]
//
// Deliberately out of scope (per the adopted spec): accounts, matchmaking,
// relays, NAT traversal. Colocation ruling: this runs on the game VM and
// its own server is simply the first listing.

import http from "node:http";

const HEARTBEAT_TTL_MS = 3 * 60 * 1000; // 3 missed heartbeats = delisted
const REPROBE_MS = 5 * 60 * 1000;
const ANNOUNCE_FLOOR_MS = 5 * 1000;     // per-IP rate floor
const BODY_CAP = 4 * 1024;
const PROBE_TIMEOUT_MS = 3000;

// host:port only — never a URL (the sibling's most common misconfig).
export function parseAddr(addr) {
  if (typeof addr !== "string" || addr.includes("://") || addr.includes("/")) return null;
  const cut = addr.lastIndexOf(":");
  if (cut <= 0) return null;
  const host = addr.slice(0, cut);
  const port = Number(addr.slice(cut + 1));
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port };
}

// Anti-relay guard: refuse advertising internal addresses.
export function isInternalHost(host) {
  if (host === "localhost" || host === "0.0.0.0") return true;
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false; // DNS names pass in v1 (spec: hardening follow-up)
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export function createMaster({ allowLocal = false, probe = null, now = () => Date.now() } = {}) {
  const registry = new Map(); // addr -> entry
  const lastAnnounceByIp = new Map();

  const defaultProbe = (addr) => new Promise((resolve) => {
    const { host, port } = parseAddr(addr);
    const req = http.get({ host, port, path: "/health", timeout: PROBE_TIMEOUT_MS }, (res) => {
      res.resume();
      resolve({ reachable: true, status: res.statusCode });
    });
    req.on("timeout", () => { req.destroy(); resolve({ reachable: false, reason: "probe timeout" }); });
    req.on("error", (e) => resolve({ reachable: false, reason: `unreachable (${e.code ?? "connect failed"})` }));
  });
  const doProbe = probe ?? defaultProbe;

  async function announce(body, ip) {
    const last = lastAnnounceByIp.get(ip);
    if (last !== undefined && now() - last < ANNOUNCE_FLOOR_MS) {
      return { status: 429, out: { error: "slow down" } };
    }
    lastAnnounceByIp.set(ip, now());

    const addr = String(body.addr ?? "");
    const parsed = parseAddr(addr);
    if (!parsed) return { status: 400, out: { error: "badAddress: addr must be host:port (no scheme; behind TLS use the PUBLIC port)" } };
    if (!allowLocal && isInternalHost(parsed.host)) {
      return { status: 400, out: { error: "badAddress: internal/loopback addresses cannot be advertised" } };
    }
    const entry = registry.get(addr) ?? { addr, firstSeen: now() };
    entry.name = String(body.name ?? addr).slice(0, 80);
    entry.version = String(body.version ?? "dev").slice(0, 40);
    entry.fixtureVersion = Number(body.fixtureVersion ?? 0);
    entry.openSeats = Number(body.openSeats ?? 0);
    entry.lastSeen = now();
    if (!entry.probedAt || now() - entry.probedAt > REPROBE_MS) {
      const p = await doProbe(addr);
      entry.probedAt = now();
      entry.reachable = p.reachable;
      entry.reason = p.reachable ? null : p.reason;
    }
    registry.set(addr, entry);
    return {
      status: entry.reachable ? 200 : 409,
      out: entry.reachable
        ? { listed: true }
        : { listed: false, reason: `${entry.reason} — check port forwarding for ${addr}` },
    };
  }

  function sweep() {
    for (const [addr, e] of registry) {
      if (now() - e.lastSeen > HEARTBEAT_TTL_MS) registry.delete(addr);
    }
  }

  function servers() {
    sweep();
    return [...registry.values()]
      .filter((e) => e.reachable)
      .map((e) => ({
        name: e.name, addr: e.addr, version: e.version,
        fixtureVersion: e.fixtureVersion, openSeats: e.openSeats,
        ageMs: now() - e.lastSeen,
      }));
  }

  return { announce, servers, sweep, registry };
}

export function startMasterServer(master, port) {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*"); // public data by design
    if (req.method === "GET" && req.url === "/servers") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ servers: master.servers() }));
      return;
    }
    if (req.method === "POST" && req.url === "/announce") {
      let size = 0;
      const chunks = [];
      req.on("data", (c) => {
        size += c.length;
        if (size > BODY_CAP * 16) { req.destroy(); return; } // hard abort
        chunks.push(c);
      });
      req.on("end", async () => {
        if (size > BODY_CAP) { res.statusCode = 413; res.end("{}"); return; }
        let body = {};
        try { body = JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch { /* bad json = empty */ }
        const ip = req.socket.remoteAddress ?? "?";
        const verdict = await master.announce(body, ip);
        res.statusCode = verdict.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(verdict.out));
      });
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

const isMain = process.argv[1] && process.argv[1].endsWith("master.js");
if (isMain) {
  const port = Number(process.argv.includes("--port")
    ? process.argv[process.argv.indexOf("--port") + 1] : 8972);
  const allowLocal = process.argv.includes("--allow-local");
  const master = createMaster({ allowLocal });
  setInterval(() => master.sweep(), 60 * 1000);
  startMasterServer(master, port).then(() =>
    console.log(`Fireline Command master index on :${port}${allowLocal ? " (allow-local)" : ""}`));
}
