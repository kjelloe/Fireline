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

  return {
    app,
    httpServer,
    gameServer,
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
      return new Promise((resolve) => httpServer.listen(port, () => resolve(httpServer.address())));
    },
    async stop() {
      gameServer.stop();
      this.clearHeartbeat?.();
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

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const port = Number(process.env.PORT ?? 8080);
  const mapSeed = Number(process.env.MAP_SEED ?? 2026);
  const aiDifficulty = Number(process.env.AI_DIFFICULTY ?? 1);
  const mapProfile = process.env.MAP ?? "frontier_corridor"; // 11M
  const appServer = createAppServer({ mapSeed, aiDifficulty, mapProfile });
  appServer.start(port).then((addr) => {
    console.log(`More Firepower server on http://localhost:${addr.port} (mapSeed ${mapSeed}, aiDifficulty ${aiDifficulty})`);
  });
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => {
      console.log(`${signal}: graceful shutdown`);
      appServer.shutdown().then(() => process.exit(0));
    });
  }
}
