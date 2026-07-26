# Slice 10A (plan 2.1, slim): spectator role — fog-free read-only ws seat.
# buildSpectatorView + c_spectate handshake + broadcast + client button.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

# ── view.js: the omniscient read-only view ───────────────────────────────────
patch("engine/view.js",
"""export function buildView(state, team) {""",
"""// 10A: spectators see the whole war — every asset with full telemetry,
// both teams' downed operators, every mine, all events (pings included).
// Shaped like a player view (assets ride in friendlyAssets) so the client
// renders it without a special path. Read-only by transport contract.
export function buildSpectatorView(state) {
  const friendlyAssets = state.assets.map((a) => ({
    id: a.id, type: a.type, team: a.team, state: a.state,
    x: a.x, y: a.y, targetX: a.targetX, targetY: a.targetY,
    hp: a.hp, operatorId: a.operatorId,
    ammo: a.ammo, fuel: a.fuel,
    towedBy: a.towedBy, recoverTimer: a.recoverTimer,
    reloadTimer: a.reloadTimer,
    heading: a.heading, minesLeft: a.minesLeft,
    aboard1: a.aboard1, aboard2: a.aboard2,
  }));
  return {
    tick: state.tick,
    team: -1,
    spectator: true,
    phase: state.phase,
    winner: state.winner,
    teamScores: [...state.teamScores],
    events: state.events,
    mapCells: state.map.cells,
    friendlyAssets,
    visibleEnemies: [],
    sites: state.sites.map((s) => ({
      id: s.id, type: s.type, owner: s.owner, cellX: s.cellX, cellY: s.cellY,
    })),
    bases: state.bases.map((b) => ({ ...b })),
    standards: state.standards.map((st) => ({ ...st })),
    downedOperators: state.downed.map((d) => ({ ...d })),
    mines: state.mines.map((m) => ({
      id: m.id, team: m.team, cellX: m.cellX, cellY: m.cellY,
      armed: m.armTimer === 0, marked: m.marked === 1,
    })),
    drones: state.drones.map((d) => ({
      id: d.id, team: d.team, x: d.x, y: d.y, targetAssetId: d.targetAssetId,
    })),
  };
}

export function buildView(state, team) {""")

# ── transport: c_spectate handshake, read-only guard, broadcast ──────────────
patch("engine/transport.js",
"""            // Handle Gameplay Commands
            if (!session || !session.authenticated) return;""",
"""            // 10A: spectator handshake — no operator slot, no team, no voice.
            if (msg.type === "c_spectate") {
                if (session) return; // already seated
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
            }""")
patch("engine/transport.js",
"""        const session = this.sessions.get(ws);
        if (session) {
            this.reserved.delete(session.operatorId);
            // 3C: the dropped operator's assets fall to AI regency.
            if (session.authenticated) this.server.assumeRegency(session.operatorId);
        }""",
"""        const session = this.sessions.get(ws);
        if (session && !session.spectator) {
            this.reserved.delete(session.operatorId);
            // 3C: the dropped operator's assets fall to AI regency.
            if (session.authenticated) this.server.assumeRegency(session.operatorId);
        }""")
patch("engine/transport.js",
"""    broadcastSnapshots(snapshot) {
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
    }""",
"""    broadcastSnapshots(snapshot) {
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
    }""")
src = open("engine/transport.js").read()
if "buildSpectatorView" not in src.split("\n")[0:20].__str__():
    patch("engine/transport.js",
"""import { OP_ABSENT } from "./state.js";""",
"""import { OP_ABSENT } from "./state.js";
import { buildSpectatorView } from "./view.js";""")

# onWarReset: spectators just get the fresh map, no join_operator.
patch("engine/transport.js",
"""        for (const session of this.sessions.values()) {
            if (!session.authenticated) continue;
            this.server.enqueue({
                type: "join_operator", operatorId: session.operatorId, team: session.team,
            });
            session.send("s_war_reset", { mapSeed });
            this.sendMap(session);
        }""",
"""        for (const session of this.sessions.values()) {
            if (!session.authenticated) continue;
            if (!session.spectator) {
                this.server.enqueue({
                    type: "join_operator", operatorId: session.operatorId, team: session.team,
                });
            }
            session.send("s_war_reset", { mapSeed });
            this.sendMap(session);
        }""")
print("10A patched")
