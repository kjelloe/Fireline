// engine/transport.js
// WebSocket adapter for the GameServer.
// For browser/mobile access, this uses standard WebSocket.
// In Node.js, we assume 'ws' library is available.

import { Session } from "./session.js";
import { OP_ABSENT } from "./state.js";

// Human operator slots are 0..15; 16..23 belong to AI regency (2B policy).
const HUMAN_SLOT_MAX = 15;

export class NetworkTransport {
    constructor(server, wsServer) {
        this.server = server;
        this.wss = wsServer;
        this.sessions = new Map(); // socket -> Session
        this.reserved = new Set(); // operator ids held by live connections

        this.wss.on("connection", (ws) => {
            ws.on("message", (raw) => this.handleMessage(ws, raw));
            ws.on("close", () => this.handleDisconnect(ws));
        });
    }

    pickOperatorId(requested) {
        if (Number.isInteger(requested)) {
            if (requested < 0 || requested > HUMAN_SLOT_MAX) return { error: "invalid operatorId" };
            if (this.reserved.has(requested)) return { error: "operator already connected" };
            if (this.server.state.operators[requested].state !== OP_ABSENT) {
                return { error: "operator already active" };
            }
            return { operatorId: requested };
        }
        for (let id = 0; id <= HUMAN_SLOT_MAX; id++) {
            if (this.reserved.has(id)) continue;
            if (this.server.state.operators[id].state !== OP_ABSENT) continue;
            return { operatorId: id };
        }
        return { error: "no free operator slots" };
    }

    handleMessage(ws, raw) {
        try {
            const msg = JSON.parse(raw);
            let session = this.sessions.get(ws);

            // Handle Join Handshake
            if (msg.type === "c_join") {
                if (session) return; // already joined
                const { team } = msg;
                if (team !== 0 && team !== 1) {
                    ws.send(JSON.stringify({ type: "s_rejected", reason: "invalid team" }));
                    return;
                }
                const picked = this.pickOperatorId(msg.operatorId);
                if (picked.error) {
                    ws.send(JSON.stringify({ type: "s_rejected", reason: picked.error }));
                    return;
                }
                const operatorId = picked.operatorId;
                const result = this.server.enqueue({ type: "join_operator", operatorId, team });
                if (result.accepted) {
                    this.reserved.add(operatorId);
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
        const session = this.sessions.get(ws);
        if (session) this.reserved.delete(session.operatorId);
        this.sessions.delete(ws);
        // Note: the operator remains OP_ACTIVE in state until disconnect/regency
        // takeover logic arrives in a later milestone (3C).
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
