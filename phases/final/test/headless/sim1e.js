import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import { GameServer } from "../../engine/server.js";
import { NetworkTransport } from "../../engine/transport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const app = express();
const serverHttp = http.createServer(app);
const wss = new WebSocketServer({ server: serverHttp });

const game = new GameServer({ mapSeed: 42, enableAi: true });
const transport = new NetworkTransport(game, wss);

// Serve static client files
app.use(express.static(path.join(__dirname, "../../client")));

serverHttp.listen(PORT, () => {
    console.log("=== Milestone 1E Battle Server + Client ===");
    console.log(`Open in browser: http://localhost:${PORT}/?op=0&team=0`);
    console.log(`For mobile: Check your LAN IP (e.g., http://192.168.x.x:${PORT}/?op=1&team=0)`);
});

game.start({ onSnapshot(snapshot) {
    transport.broadcastSnapshots(snapshot);
}});

process.on("SIGINT", () => {
    game.stop();
    serverHttp.close();
    process.exit();
});
