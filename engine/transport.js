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
        this.players = new Map(); // persistent playerId -> operatorId (5B)

        this.wss.on("connection", (ws) => {
            ws.on("message", (raw) => this.handleMessage(ws, raw));
            ws.on("close", () => this.handleDisconnect(ws));
            ws.on("pong", () => {
                const session = this.sessions.get(ws);
                if (session) session.lastSeenMs = Date.now();
            });
        });
    }

    // 8I: ping live sessions; terminate the silent ones. Termination triggers
    // the normal close path (reservation release + AI regency takeover).
    checkHeartbeats(nowMs, timeoutMs = 5000) {
        const dropped = [];
        for (const [ws, session] of this.sessions.entries()) {
            if (nowMs - session.lastSeenMs > timeoutMs) {
                dropped.push(session.operatorId);
                ws.terminate();
            } else if (ws.readyState === 1 && typeof ws.ping === "function") {
                ws.ping();
            }
        }
        return dropped;
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
            if (session) session.lastSeenMs = Date.now(); // 8I

            // Handle Join Handshake
            if (msg.type === "c_join") {
                if (session) return; // already joined
                const { team } = msg;
                if (team !== 0 && team !== 1) {
                    ws.send(JSON.stringify({ type: "s_rejected", reason: "invalid team" }));
                    return;
                }

                // 5B: a returning playerId reattaches to its operator slot and
                // takes it back from AI regency.
                const playerId = typeof msg.playerId === "string" && msg.playerId.length <= 64
                    ? msg.playerId : null;
                const knownOperator = playerId != null ? this.players.get(playerId) : undefined;
                if (knownOperator !== undefined) {
                    if (this.reserved.has(knownOperator)) {
                        ws.send(JSON.stringify({ type: "s_rejected", reason: "player already connected" }));
                        return;
                    }
                    const operator = this.server.state.operators[knownOperator];
                    this.reserved.add(knownOperator);
                    this.server.releaseRegency(knownOperator);
                    session = new Session(ws, knownOperator);
                    session.team = operator.team;
                    session.playerId = playerId;
                    session.authenticated = true;
                    this.sessions.set(ws, session);
                    session.send("s_joined", {
                        operatorId: knownOperator, team: operator.team, rejoined: true, sequence: null,
                    });
                    this.sendMap(session);
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
                    if (playerId != null) this.players.set(playerId, operatorId);
                    session = new Session(ws, operatorId);
                    session.team = team;
                    session.playerId = playerId;
                    session.authenticated = true;
                    this.sessions.set(ws, session);
                    session.send("s_joined", { operatorId, team, sequence: result.sequence });
                    this.sendMap(session);
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
        if (session) {
            this.reserved.delete(session.operatorId);
            // 3C: the dropped operator's assets fall to AI regency.
            if (session.authenticated) this.server.assumeRegency(session.operatorId);
        }
        this.sessions.delete(ws);
    }

    // 8C: a new war began. Connected players stay connected: re-join their
    // operator slots into the fresh state and re-ship the new terrain.
    onWarReset(mapSeed) {
        for (const session of this.sessions.values()) {
            if (!session.authenticated) continue;
            this.server.enqueue({
                type: "join_operator", operatorId: session.operatorId, team: session.team,
            });
            session.send("s_war_reset", { mapSeed });
            this.sendMap(session);
        }
    }

    // 6A: terrain is immutable — ship it once per session, not per snapshot.
    sendMap(session) {
        const map = this.server.state.map;
        session.send("s_map", {
            width: map.width,
            height: map.height,
            mapCells: Array.from(map.cells),
        });
    }

    broadcastSnapshots(snapshot) {
        for (const session of this.sessions.values()) {
            if (!session.authenticated || session.team === -1) continue;
            // 6A: strip the static mapCells from the per-tick payload.
            const { mapCells, ...view } = snapshot.views[session.team];
            session.send("s_snapshot", {
                tick: snapshot.tick,
                stateHash: snapshot.stateHash,
                view
            });
        }
    }
}
