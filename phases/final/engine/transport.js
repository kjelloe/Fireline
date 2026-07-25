// engine/transport.js — Milestone 1F
// WebSocket router: join handshake, snapshot broadcast.

import { WebSocketServer } from "ws";

export function attachTransport(httpServer, gameServer) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws) => {
    let operatorId = null;
    let team = null;

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === "c_join") {
        operatorId = msg.operatorId;
        team = msg.team;
        gameServer.enqueue({ type: "join_operator", operatorId, team });
        gameServer.registerSession(operatorId, team, ws);
        ws.send(JSON.stringify({ type: "s_joined", operatorId, team, sequence: 0 }));
        return;
      }

      if (operatorId !== null) {
        gameServer.enqueue({ ...msg, operatorId });
      }
    });

    ws.on("close", () => {
      if (operatorId !== null) gameServer.removeSession(operatorId);
    });
  });

  return wss;
}

export function broadcastSnapshot(gameServer, snapshot) {
  for (const session of Object.values(gameServer.sessions)) {
    const view = snapshot.views[session.team];
    if (view && session.ws.readyState === 1) {
      session.ws.send(JSON.stringify({ type: "s_snapshot", ...view }));
    }
  }
}
