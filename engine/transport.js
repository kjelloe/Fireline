// engine/transport.js
// WebSocket adapter for the GameServer.
// For browser/mobile access, this uses standard WebSocket.
// In Node.js, we assume 'ws' library is available.

import { Session } from "./session.js";
import { OP_ABSENT } from "./state.js";
import { buildSpectatorView } from "./view.js";

// Human operator slots are 0..15; 16..23 belong to AI regency (2B policy).
const HUMAN_SLOT_MAX = 15;

export class NetworkTransport {
    constructor(server, wsServer, options = {}) {
        this.server = server;
        this.wss = wsServer;
        this.sessions = new Map(); // socket -> Session
        this.reserved = new Set(); // operator ids held by live connections
        this.players = new Map(); // persistent playerId -> operatorId (5B)
        this.names = new Map(); // operatorId -> display name (O2, prompt 164)
        // Prompt 149: lobby config — server owners may disable the
        // spectator booth and the replay archive.
        this.spectateEnabled = options.spectate !== false;
        this.replaysEnabled = options.replays !== false;

        this.wss.on("connection", (ws) => {
            ws.on("message", (raw) => this.handleMessage(ws, raw));
            ws.on("close", () => this.handleDisconnect(ws));
            ws.on("pong", () => {
                const session = this.sessions.get(ws);
                if (session) session.lastSeenMs = Date.now();
            });
            this.sendLobby(ws); // the join screen needs counts before joining
        });
    }

    // Prompt 149: per-team HUMAN head-count (joined, non-spectator).
    humanCounts() {
        const counts = [0, 0];
        for (const s of this.sessions.values()) {
            if (s.authenticated && !s.spectator && (s.team === 0 || s.team === 1)) {
                counts[s.team] += 1;
            }
        }
        return counts;
    }

    // The lobby packet: live team head-counts + what this server allows.
    // Broadcast to EVERY socket (joined or not) on every seat change, so
    // a player can wait for their favourite team to have room.
    sendLobby(oneWs = null) {
        const payload = JSON.stringify({
            type: "s_lobby",
            humans: this.humanCounts(),
            spectate: this.spectateEnabled,
            replays: this.replaysEnabled,
            names: Object.fromEntries(this.names), // O2: opId -> name
        });
        const targets = oneWs ? [oneWs] : [...this.wss.clients];
        for (const ws of targets) {
            if (ws.readyState === 1) { try { ws.send(payload); } catch { /* racing close */ } }
        }
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
                // O2 (prompt 164): a display name — recognition finally
                // pays a PERSON. Sanitised, 16 chars, transport-only.
                const name = typeof msg.name === "string"
                    ? msg.name.replace(/[^\p{L}\p{N} _\-\.]/gu, "").slice(0, 16).trim()
                    : "";
                const knownOperator = playerId != null ? this.players.get(playerId) : undefined;
                if (knownOperator !== undefined) {
                    // Prompt 139 (mobile resilience): the token IS the person.
                    // A mobile resume rarely closes the old socket first, so a
                    // live duplicate is the SAME player coming back, not an
                    // intruder — the newest connection wins the seat and the
                    // stale socket is evicted. Idempotent by construction: the
                    // seat is reused, never minted twice. (The token is
                    // private; guessing it is the only impersonation path,
                    // same trust model as 5B.)
                    if (this.reserved.has(knownOperator)) {
                        for (const [oldWs, oldSession] of this.sessions.entries()) {
                            if (oldSession.spectator || oldSession.operatorId !== knownOperator) continue;
                            this.sessions.delete(oldWs); // its close event becomes a no-op
                            try { oldWs.close(4000, "seat resumed elsewhere"); }
                            catch { oldWs.terminate?.(); }
                        }
                    }
                    const operator = this.server.state.operators[knownOperator];
                    this.reserved.add(knownOperator);
                    this.server.releaseRegency(knownOperator);
                    session = new Session(ws, knownOperator);
                    session.team = operator.team;
                    session.playerId = playerId;
                    session.authenticated = true;
                    this.sessions.set(ws, session);
                    if (name) this.names.set(knownOperator, name);
                    session.send("s_joined", {
                        operatorId: knownOperator, team: operator.team, rejoined: true, sequence: null,
                    });
                    this.sendMap(session);
                    this.sendLobby();
                    return;
                }

                // Prompt 149: TEAM BALANCE — a fresh join is refused
                // when the chosen side already has two or more MORE
                // humans than the other. Token reclaims never pass here
                // (the knownOperator path returns above): you always
                // get your own seat back.
                const counts = this.humanCounts();
                if (counts[team] >= counts[team === 0 ? 1 : 0] + 2) {
                    ws.send(JSON.stringify({ type: "s_rejected", reason: "team full" }));
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
                    if (name) this.names.set(operatorId, name);
                    session.send("s_joined", { operatorId, team, sequence: result.sequence });
                    this.sendMap(session);
                    this.sendLobby();
                } else {
                    ws.send(JSON.stringify({ type: "s_rejected", reason: result.reason }));
                }
                return;
            }

            // Q49: map+mode pair voting — a postgame TRANSPORT concern,
            // never reducer state (votes are opinions, not gameplay).
            if (msg.type === "c_vote") {
                if (!session || !session.authenticated || session.spectator) return;
                if (!this.voteCandidates) return; // no vote open
                const choice = msg.choice;
                if (!Number.isInteger(choice) || choice < 0 || choice >= this.voteCandidates.length) return;
                session.vote = choice;
                session.send("s_vote_ack", { choice });
                // Prompt 160 item 4: LIVE tallies — every voter sees the
                // count grow on the map tiles.
                this.broadcastVoteCounts();
                return;
            }

            // 10A: spectator handshake — no operator slot, no team, no voice.
            if (msg.type === "c_spectate") {
                if (session) return; // already seated
                if (!this.spectateEnabled) {
                    ws.send(JSON.stringify({ type: "s_rejected", reason: "spectating disabled" }));
                    return;
                }
                session = new Session(ws, -1);
                session.team = -1;
                session.spectator = true;
                session.authenticated = true;
                this.sessions.set(ws, session);
                session.send("s_spectating", {});
                this.sendMap(session);
                return;
            }

            // Handle Gameplay Commands
            if (!session || !session.authenticated) return;
            if (session.spectator) {
                session.send("s_rejected", { seq: msg.seq, reason: "spectators only watch" });
                return;
            }
            // 11J ops hardening: per-connection token bucket. Purely a
            // transport concern — a dropped command never reaches the
            // reducer, so replays and determinism are untouched. Budget is
            // generous for humans (direct drive streams intent) and tight
            // enough to stop runaway scripts.
            if (!this.allowCommand(session, Date.now())) {
                session.send("s_rejected", { seq: msg.seq, reason: "rate limited" });
                return;
            }

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

    // 11J: 30 commands/second sustained, burst of 60. Injectable clock for
    // tests via the nowMs argument.
    allowCommand(session, nowMs) {
        const RATE = 30;
        const BURST = 60;
        if (session.rl === undefined) {
            session.rl = { tokens: BURST, lastMs: nowMs };
        }
        const b = session.rl;
        b.tokens = Math.min(BURST, b.tokens + ((nowMs - b.lastMs) / 1000) * RATE);
        b.lastMs = nowMs;
        if (b.tokens < 1) return false;
        b.tokens -= 1;
        return true;
    }

    handleDisconnect(ws) {
        const session = this.sessions.get(ws);
        if (session && !session.spectator) {
            this.reserved.delete(session.operatorId);
            // 3C: the dropped operator's assets fall to AI regency.
            if (session.authenticated) this.server.assumeRegency(session.operatorId);
        }
        this.sessions.delete(ws);
        this.sendLobby(); // seats changed — the join screens update
    }

    // Q49: open the postgame vote — three (map, mode) pairs, one human
    // one vote, plurality wins, silence keeps the status quo (index 0).
    openVote(candidates) {
        this.voteCandidates = candidates;
        for (const session of this.sessions.values()) {
            session.vote = undefined;
            if (session.authenticated) session.send("s_vote_open", { candidates });
        }
    }

    broadcastVoteCounts() {
        if (!this.voteCandidates) return;
        const counts = this.voteCandidates.map(() => 0);
        for (const s of this.sessions.values()) {
            if (s.authenticated && !s.spectator && Number.isInteger(s.vote)) counts[s.vote] += 1;
        }
        for (const s of this.sessions.values()) {
            if (s.authenticated) s.send("s_vote_update", { counts });
        }
    }

    tallyVote() {
        if (!this.voteCandidates) return null;
        const counts = this.voteCandidates.map(() => 0);
        for (const session of this.sessions.values()) {
            if (!session.authenticated || session.spectator) continue;
            if (Number.isInteger(session.vote)) counts[session.vote] += 1;
        }
        let winner = 0;
        for (let i = 1; i < counts.length; i++) if (counts[i] > counts[winner]) winner = i;
        const pick = this.voteCandidates[winner];
        this.voteCandidates = null;
        for (const session of this.sessions.values()) session.vote = undefined;
        return { pick, counts, winner };
    }

    // 8C: a new war began. Connected players stay connected: re-join their
    // operator slots into the fresh state and re-ship the new terrain.
    onWarReset(mapSeed) {
        for (const session of this.sessions.values()) {
            if (!session.authenticated) continue;
            if (!session.spectator) {
                this.server.enqueue({
                    type: "join_operator", operatorId: session.operatorId, team: session.team,
                });
            }
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
            mapProfile: this.server.state.mapProfile, // 14A: world dressing
        });
    }

    broadcastSnapshots(snapshot) {
        let spectatorView = null; // 10A: built once per tick, only on demand
        for (const session of this.sessions.values()) {
            if (!session.authenticated) continue;
            let source;
            if (session.spectator) {
                spectatorView ??= buildSpectatorView(this.server.state);
                source = spectatorView;
            } else if (session.team === -1) {
                continue;
            } else {
                source = snapshot.views[session.team];
            }
            // 6A: strip the static mapCells from the per-tick payload.
            const { mapCells, ...view } = source;
            session.send("s_snapshot", {
                tick: snapshot.tick,
                stateHash: snapshot.stateHash,
                view
            });
        }
    }
}
