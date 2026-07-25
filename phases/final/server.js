// server.js — Milestone 1F entry point
// HTTP static host + WebSocket game server + AI regents + 10 Hz tick clock.

import http from "http";
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { GameServer }      from "./engine/server.js";
import { TickClock }       from "./engine/clock.js";
import { attachTransport, broadcastSnapshot } from "./engine/transport.js";
import { createRegents }   from "./engine/ai_regent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT      = 3000;

// ── Static file server ────────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".css":  "text/css",
};

const httpServer = http.createServer((req, res) => {
  let filePath = path.join(__dirname, "client", req.url === "/" ? "index.html" : req.url);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
    res.end(data);
  });
});

// ── Game server + transport ───────────────────────────────────────────────────
const game    = new GameServer(42);
const regents = createRegents();
attachTransport(httpServer, game);

// ── Tick clock ────────────────────────────────────────────────────────────────
const clock = new TickClock(() => {
  // AI regent decisions
  for (const regent of regents) {
    const cmds = regent.decide(game.state);
    for (const cmd of cmds) game.enqueue(cmd);
  }

  const snapshot = game.tick();
  broadcastSnapshot(game, snapshot);
});

httpServer.listen(PORT, () => {
  console.log(`More Firepower 1F — http://localhost:${PORT}/?op=0&team=0`);
  clock.start();
});
