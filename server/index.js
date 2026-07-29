// server/index.js — production entry (slice 2B/2F).
// Express serves the static client; the WebSocket layer bridges browsers to
// the authoritative GameServer; a 10Hz TickClock drives steps and snapshot
// broadcast. All game logic stays in engine/.

import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer } from "ws";
import { GameServer } from "../engine/server.js";
import { mapProfileNames, rulesForPreset } from "../engine/state.js";
import { NetworkTransport } from "../engine/transport.js";
import { PHASE_OVER } from "../engine/victory.js";
import { mix32 } from "../shared/prng.js";
import { createReplayStore } from "./replay_store.js";
import { createMetrics } from "./metrics.js";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT_DIR = path.join(ROOT_DIR, "client");
const NODE_MODULES_DIR = path.join(ROOT_DIR, "node_modules");

export function createAppServer(options = {}) {
  const app = express();
  app.use(express.static(options.clientDir ?? CLIENT_DIR));
  app.use("/vendor", express.static(NODE_MODULES_DIR));
  // Client pure-model modules import engine stat tables/constants as data
  // (e.g. overlay_model → engine/units.js). Serve those layers so the
  // browser module graph resolves; authority still lives server-side.
  app.use("/engine", express.static(path.join(ROOT_DIR, "engine")));
  app.use("/shared", express.static(path.join(ROOT_DIR, "shared")));
  app.get("/favicon.ico", (req, res) => res.status(204).end());
  const startedAt = Date.now(); // operational metric only — never game logic
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      tick: gameServer.state.tick,
      phase: gameServer.state.phase,
      winner: gameServer.state.winner,
      players: transport.sessions.size,
      uptimeMs: Date.now() - startedAt,
      version: options.version ?? "dev",
    });
  });

  // 11J: what exactly is running — for BATCH_PC provenance and bug reports.
  app.get("/version", (req, res) => {
    let pkgVersion = "dev";
    let fixtureVersion = null;
    try {
      pkgVersion = JSON.parse(readFileSync(path.join(ROOT_DIR, "package.json"))).version;
      fixtureVersion = JSON.parse(
        readFileSync(path.join(ROOT_DIR, "test", "fixtures", "1A_reducer.json"))
      ).fixtureVersion;
    } catch { /* fine — a stripped deploy reports what it can */ }
    res.json({
      name: "more-firepower",
      version: pkgVersion,
      fixtureVersion,
      rules: gameServer.state.rules, // 13G: which law this war runs under
      masterUrl: options.masterUrl ?? null, // discovery: where the index lives
      mapProfile: gameServer.state.mapProfile,
      mapSeed: gameServer.state.mapSeed,
      aiDifficulty: options.aiDifficulty ?? 1,
    });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer });
  const gameServer = new GameServer({
    mapSeed: options.mapSeed ?? 2026,
    enableAi: options.enableAi ?? true,
    aiDifficulty: options.aiDifficulty ?? 1,
    snapshotCapacity: options.snapshotCapacity ?? 30,
    // 13G: these were silently dropped here — MAP=riverline served frontier.
    mapProfile: options.mapProfile ?? "frontier_corridor",
    rules: options.rules ?? null,
    // 16B: default ON per the standing design ("uniques crew by
    // default"); UNIQUES=0 disables for A/B runs. The old `=== true`
    // here + in GameServer meant the SERVED game never crewed uniques.
    uniqueCrewing: options.uniqueCrewing !== false &&
      process.env.UNIQUES !== "0",
  });
  const transport = new NetworkTransport(gameServer, wss);

  // 5A: match history. A finished war is archived exactly once.
  const replayStore = createReplayStore(
    options.replayDir ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "replays")
  );
  let archived = false;
  function archiveIfOver() {
    if (archived || gameServer.state.phase !== PHASE_OVER) return null;
    archived = true;
    return replayStore.save({
      mapSeed: gameServer.state.mapSeed,
      mapProfile: gameServer.state.mapProfile, // 11M
      rules: gameServer.state.rules, // 13F: replays must re-simulate the same law
      ticks: gameServer.state.tick,
      winner: gameServer.state.winner,
      reason: gameServer.state.winReason,
      finalHash: gameServer.getLatestSnapshot()?.stateHash ?? null,
      finishedAt: new Date().toISOString(), // operational metadata only
    }, gameServer.commandLog);
  }

  // 8C: war lifecycle — active → game_over → postgame → resetting → active.
  // The clock keeps ticking through postgame; after postgameTicks the seed
  // rotates deterministically (mix32) and connected players carry over.
  const postgameTicks = options.postgameTicks ?? 300;
  const metrics = createMetrics(); // 8I balance instrumentation
  let gameOverTick = -1;
  let warsStarted = 1;
  function pump(snapshot) {
    transport.broadcastSnapshots(snapshot);
    metrics.consumeEvents(snapshot.views[0]?.events, snapshot.tick);
    if (gameServer.state.phase === PHASE_OVER) {
      archiveIfOver();
      if (gameOverTick === -1) {
        gameOverTick = gameServer.state.tick;
        metrics.warCompleted(gameOverTick);
      }
      if (gameServer.state.tick - gameOverTick >= postgameTicks) {
        const nextSeed = mix32(gameServer.state.mapSeed);
        gameServer.resetWar(nextSeed);
        archived = false;
        gameOverTick = -1;
        warsStarted += 1;
        transport.onWarReset(nextSeed);
      }
    }
    return snapshot;
  }
  app.get("/metrics", (req, res) => res.json(metrics.snapshot()));

  app.get("/replays", (req, res) => res.json({ replays: replayStore.list() }));
  app.get("/replay/:id", (req, res) => {
    const record = replayStore.load(req.params.id);
    if (!record) { res.status(404).json({ error: "no such replay" }); return; }
    res.json(record);
  });

  // Discovery announce (specs/game-discovery.md): heartbeat the master
  // every ~60 s; ECHO its verdict on our console — every "why am I not
  // listed" support question answers itself.
  let announceTimer = null;
  async function announceOnce() {
    if (!options.masterUrl || !options.publicAddr) return;
    const openSeats = gameServer.state.operators
      .filter((o) => o.id < 16 && o.state === 0).length;
    let pkgVersion = "dev";
    try {
      pkgVersion = JSON.parse(readFileSync(path.join(ROOT_DIR, "package.json"))).version;
    } catch { /* stripped deploy */ }
    let fixtureVersion = 0;
    try {
      fixtureVersion = JSON.parse(readFileSync(
        path.join(ROOT_DIR, "test", "fixtures", "1A_reducer.json"))).fixtureVersion;
    } catch { /* fine */ }
    try {
      const res = await fetch(`${options.masterUrl}/announce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: options.publicName ?? `Fireline Command @ ${options.publicAddr}`,
          addr: options.publicAddr,
          version: pkgVersion,
          fixtureVersion,
          openSeats,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (out.listed) console.log(`master says: listed (${options.publicAddr})`);
      else console.log(`master says: ${out.reason ?? out.error ?? `HTTP ${res.status}`}`);
    } catch (e) {
      console.log(`master unreachable at ${options.masterUrl}: ${e.message}`);
    }
  }

  return {
    app,
    httpServer,
    gameServer,
    announceOnce,
    transport,
    replayStore,
    archiveIfOver,
    pump,
    get warsStarted() { return warsStarted; },
    metrics,
    start(port = 8080, clockOptions = {}) {
      gameServer.start({
        onSnapshot: (snapshot) => pump(snapshot),
        ...clockOptions,
      });
      // 8I: heartbeat sweep (real timer in production; injectable in tests).
      const hb = options.heartbeat ?? {};
      const setIntervalFn = clockOptions.setIntervalFn ?? setInterval;
      this.clearHeartbeat = () => (clockOptions.clearIntervalFn ?? clearInterval)(this.heartbeatTimer);
      this.heartbeatTimer = setIntervalFn(
        () => transport.checkHeartbeats(Date.now(), hb.timeoutMs ?? 5000),
        hb.intervalMs ?? 2000
      );
      if (options.masterUrl && options.publicAddr) {
        announceOnce();
        announceTimer = setIntervalFn(announceOnce, options.announceIntervalMs ?? 60000);
      }
      return new Promise((resolve) => httpServer.listen(port, () => resolve(httpServer.address())));
    },
    async stop() {
      gameServer.stop();
      this.clearHeartbeat?.();
      if (announceTimer) clearInterval(announceTimer);
      for (const client of wss.clients) client.terminate();
      wss.close();
      // Keep-alive sockets (e.g. fetch connection pools) would otherwise hold
      // close() open indefinitely.
      httpServer.closeAllConnections?.();
      await new Promise((resolve) => httpServer.close(resolve));
    },
    // 7E: graceful shutdown — warn clients, archive the war, then close.
    async shutdown() {
      for (const session of transport.sessions.values()) {
        session.send("s_server_closing", {});
      }
      archiveIfOver();
      if (!archived && gameServer.state.tick > 0) {
        archived = true;
        replayStore.save({
          mapSeed: gameServer.state.mapSeed,
          ticks: gameServer.state.tick,
          winner: -1,
          reason: 0, // unfinished
          finalHash: gameServer.getLatestSnapshot()?.stateHash ?? null,
          finishedAt: new Date().toISOString(),
        }, gameServer.commandLog);
      }
      await this.stop();
    },
  };
}

// prompt-76: choosing the map should not require remembering env-var
// syntax. Precedence: --map wins over MAP=, which wins over the default.
// Unknown names fail with the REAL registry listed, not a stale copy.
function parseCliArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eq = a.indexOf("=");
    const key = eq === -1 ? a : a.slice(0, eq);
    const inlineValue = eq === -1 ? null : a.slice(eq + 1);
    const take = () => (inlineValue !== null ? inlineValue : argv[++i]);
    switch (key) {
      case "--map": case "-m": out.map = take(); break;
      case "--seed": out.seed = take(); break;
      case "--port": case "-p": out.port = take(); break;
      case "--rules": out.rules = take(); break;
      case "--difficulty": out.difficulty = take(); break;
      case "--list-maps": out.listMaps = true; break;
      case "--help": case "-h": out.help = true; break;
      default:
        if (a.startsWith("-")) out.unknown = a;
    }
  }
  return out;
}

function resolveMapProfile(requested) {
  const names = mapProfileNames();
  if (!requested) return names[0];
  if (names.includes(requested)) return requested;
  // A near-miss is the common case, and it comes in two flavours: a
  // PREFIX ("frontier" for frontier_corridor) and a TYPO ("blackwod").
  // Prefix matching alone misses the typo, which is the one people
  // actually make, so measure edit distance too.
  const editDistance = (a, b) => {
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let diag = prev[0];
      prev[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = prev[j];
        prev[j] = Math.min(
          prev[j] + 1,            // deletion
          prev[j - 1] + 1,        // insertion
          diag + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
        );
        diag = tmp;
      }
    }
    return prev[b.length];
  };
  const near = names.filter((n) =>
    n.startsWith(requested) || n.includes(requested) || editDistance(n, requested) <= 3);
  const hint = near.length ? `\n  did you mean: ${near.join(", ")}?` : "";
  console.error(`unknown map: ${requested}\n  available: ${names.join(", ")}${hint}`);
  process.exit(2);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const cli = parseCliArgs(process.argv.slice(2));
  if (cli.help) {
    console.log(`Fireline Command server

  npm start                          # default map (${mapProfileNames()[0]})
  npm start -- --map blackwood       # pick a map
  npm run start:blackwood            # same thing, less typing
  npm run maps                       # list the maps
  npm run pick                       # interactive picker

options: --map|-m <profile>  --seed <n>  --port|-p <n>  --rules <preset>
         --difficulty <0|1|2>  --list-maps  --help
env (still honoured, CLI wins): MAP, MAP_SEED, PORT, RULES, AI_DIFFICULTY`);
    process.exit(0);
  }
  if (cli.listMaps) {
    console.log(mapProfileNames().join("\n"));
    process.exit(0);
  }
  if (cli.unknown) {
    console.error(`unknown option: ${cli.unknown} (try --help)`);
    process.exit(2);
  }
  const port = Number(cli.port ?? process.env.PORT ?? 8080);
  const mapSeed = Number(cli.seed ?? process.env.MAP_SEED ?? 2026);
  const aiDifficulty = Number(cli.difficulty ?? process.env.AI_DIFFICULTY ?? 1);
  const mapProfile = resolveMapProfile(cli.map ?? process.env.MAP ?? null); // 11M
  const rules = rulesForPreset(cli.rules ?? process.env.RULES ?? "normal"); // 13G presets
  const appServer = createAppServer({
    mapSeed, aiDifficulty, mapProfile, rules,
    // Discovery (colocation ruling): MASTER_URL points at the index,
    // PUBLIC_ADDR is host:port as the INTERNET reaches us (behind TLS:
    // the public port, not the process port), PUBLIC_NAME optional.
    masterUrl: process.env.MASTER_URL || null,
    publicAddr: process.env.PUBLIC_ADDR || null,
    publicName: process.env.PUBLIC_NAME || null,
  });
  appServer.start(port).then((addr) => {
    console.log(`Fireline Command server on http://localhost:${addr.port}`);
    console.log(`  map ${mapProfile} · seed ${mapSeed} · AI ${aiDifficulty} · rules ${cli.rules ?? process.env.RULES ?? "normal"}`);
  });
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => {
      console.log(`${signal}: graceful shutdown`);
      appServer.shutdown().then(() => process.exit(0));
    });
  }
}
