// test/headless/sim1c.js
// Run after npm install: node test/headless/sim1c.js
// Visit with a WebSocket client, not an ordinary HTTP page. A browser opening
// http://localhost:3000 correctly receives "Upgrade Required" from this WS-only port.

import { WebSocketServer } from "ws";
import { GameServer } from "../../engine/server.js";
import { NetworkTransport } from "../../engine/transport.js";

const PORT = 3000;
const server = new GameServer({ mapSeed: 42, enableAi: true });
const wss = new WebSocketServer({ port: PORT });
const transport = new NetworkTransport(server, wss);

console.log("=== Milestone 1C/1D Networked Server ===");
console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
console.log("This is a WebSocket-only endpoint; HTTP browser navigation will say Upgrade Required.");

server.start({ onSnapshot(snapshot) {
  transport.broadcastSnapshots(snapshot);
  if (snapshot.tick % 50 === 0) {
    console.log(`Tick ${snapshot.tick} | sessions: ${transport.sessions.size} | ${snapshot.stateHash}`);
  }
}});

process.on("SIGINT", () => {
  server.stop();
  wss.close();
  process.exit();
});
