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

const CLIENT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "client");
const NODE_MODULES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "node_modules");

export function createAppServer(options = {}) {
  const app = express();
  app.use(express.static(options.clientDir ?? CLIENT_DIR));
  app.use("/vendor", express.static(NODE_MODULES_DIR));
  app.get("/health", (req, res) => {
    res.json({ status: "ok", tick: gameServer.state.tick, version: options.version ?? "dev" });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer });
  const gameServer = new GameServer({
    mapSeed: options.mapSeed ?? 2026,
    enableAi: options.enableAi ?? true,
    snapshotCapacity: options.snapshotCapacity ?? 30,
  });
  const transport = new NetworkTransport(gameServer, wss);

  return {
    app,
    httpServer,
    gameServer,
    transport,
    start(port = 8080, clockOptions = {}) {
      gameServer.start({
        onSnapshot: (snapshot) => transport.broadcastSnapshots(snapshot),
        ...clockOptions,
      });
      return new Promise((resolve) => httpServer.listen(port, () => resolve(httpServer.address())));
    },
    async stop() {
      gameServer.stop();
      wss.close();
      await new Promise((resolve) => httpServer.close(resolve));
    },
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const port = Number(process.env.PORT ?? 8080);
  const mapSeed = Number(process.env.MAP_SEED ?? 2026);
  const appServer = createAppServer({ mapSeed });
  appServer.start(port).then((addr) => {
    console.log(`More Firepower server on http://localhost:${addr.port} (mapSeed ${mapSeed})`);
  });
}
