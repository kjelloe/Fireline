// server/index.js — production entry (slice 2B/2F).
// Express serves the static client; the WebSocket layer bridges browsers to
// the authoritative GameServer; a 10Hz TickClock drives steps and snapshot
// broadcast. All game logic stays in engine/.

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer } from "ws";
import { GameServer } from "../engine/server.js";
import { NetworkTransport } from "../engine/transport.js";
import { createReplayStore } from "./replay_store.js";

const CLIENT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "client");
const NODE_MODULES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "node_modules");

export function createAppServer(options = {}) {
  const app = express();
  app.use(express.static(options.clientDir ?? CLIENT_DIR));
  app.use("/vendor", express.static(NODE_MODULES_DIR));
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
    if (archived || gameServer.state.phase !== 1) return null;
    archived = true;
    return replayStore.save({
      mapSeed: gameServer.state.mapSeed,
      ticks: gameServer.state.tick,
      winner: gameServer.state.winner,
      reason: gameServer.state.winReason,
      finalHash: gameServer.getLatestSnapshot()?.stateHash ?? null,
      finishedAt: new Date().toISOString(), // operational metadata only
    }, gameServer.commandLog);
  }

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
    start(port = 8080, clockOptions = {}) {
      gameServer.start({
        onSnapshot: (snapshot) => {
          transport.broadcastSnapshots(snapshot);
          archiveIfOver();
        },
        ...clockOptions,
      });
      return new Promise((resolve) => httpServer.listen(port, () => resolve(httpServer.address())));
    },
    async stop() {
      gameServer.stop();
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
  const appServer = createAppServer({ mapSeed, aiDifficulty });
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
