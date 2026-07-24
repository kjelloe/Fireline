// engine/transport.js
// WebSocket adapter for the GameServer.
// For browser/mobile access, this uses standard WebSocket.
// In Node.js, we assume 'ws' library is available.

import { Session } from "./session.js";

export class NetworkTransport {
    constructor(server, wsServer) {
        this.server = server;
        this.wss = wsServer;
        this.sessions = new Map(); // socket -> Session

        this.wss.on("connection", (ws) => {
            ws.on("message", (raw) => this.handleMessage(ws, raw));
            ws.on("close", () => this.handleDisconnect(ws));
        });
    }

    handleMessage(ws, raw) {
        try {
            const msg = JSON.parse(raw);
            let session = this.sessions.get(ws);

            // Handle Join Handshake
            if (msg.type === "c_join") {
                if (session) return; // already joined
                const { operatorId, team } = msg;
                const result = this.server.enqueue({ type: "join_operator", operatorId, team });
                if (result.accepted) {
                    session = new Session(ws, operatorId);
                    session.team = team;
                    session.authenticated = true;
                    this.sessions.set(ws, session);
                    session.send("s_joined", { operatorId, team, sequence: result.sequence });
                } else {
                    ws.send(JSON.stringify({ type: "s_rejected", reason: result.reason }));
                }
                return;
            }

            // Handle Gameplay Commands
            if (!session || !session.authenticated) return;

            // Map transport signal to server command
            const cmd = { ...msg, operatorId: session.operatorId };
            const result = this.server.enqueue(cmd);
            if (!result.accepted) {
                session.send("s_rejected", { seq: msg.seq, reason: result.reason });
            }

        } catch (e) {
            console.error("Transport error:", e);
        }
    }

    handleDisconnect(ws) {
        this.sessions.delete(ws);
        // Note: operator remains in state.state (OP_ACTIVE) until a timeout/disconnect reducer
        // logic is implemented in a later milestone.
    }

    broadcastSnapshots(snapshot) {
        // Differential snapshots / per-team views
        for (const session of this.sessions.values()) {
            if (!session.authenticated || session.team === -1) continue;
            const view = snapshot.views[session.team];
            session.send("s_snapshot", {
                tick: snapshot.tick,
                stateHash: snapshot.stateHash,
                view
            });
        }
    }
}
