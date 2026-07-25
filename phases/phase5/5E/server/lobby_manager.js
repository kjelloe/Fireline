// server/lobby_manager.js — Matchmaking & Lobbies (5E)
// Manages player grouping, ready states, and match start.

export class LobbyManager {
  constructor() {
    this.lobbies = new Map(); // lobbyId -> lobby
    this.players = new Map(); // playerId -> lobbyId
    this.queue = []; // Simple matchmaking queue
  }

  createLobby(hostId, options = {}) {
    const lobbyId = `lobby_${Date.now()}_${hostId}`;
    const lobby = {
      id: lobbyId,
      hostId,
      players: [hostId],
      ready: new Set(),
      started: false,
      options
    };
    this.lobbies.set(lobbyId, lobby);
    this.players.set(hostId, lobbyId);
    return lobby;
  }

  joinLobby(playerId, lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;
    if (lobby.started) return null;
    if (!lobby.players.includes(playerId)) {
      lobby.players.push(playerId);
      this.players.set(playerId, lobbyId);
    }
    return lobby;
  }

  setReady(playerId, isReady = true) {
    const lobbyId = this.players.get(playerId);
    if (!lobbyId) return null;
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;

    if (isReady) lobby.ready.add(playerId);
    else lobby.ready.delete(playerId);
    return lobby;
  }

  canStart(lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return false;
    return lobby.players.length >= 2 && 
           lobby.ready.size === lobby.players.length &&
           !lobby.started;
  }

  startMatch(lobbyId) {
    if (!this.canStart(lobbyId)) return null;
    const lobby = this.lobbies.get(lobbyId);
    lobby.started = true;
    return lobby;
  }

  // Simple matchmaking: add to queue, try to match
  queueForMatch(playerId, skillRating = 0) {
    this.queue.push({ playerId, skillRating, time: Date.now() });
    return this.tryMatch();
  }

  tryMatch() {
    if (this.queue.length < 2) return null;
    // Simple matching: sort by time, pair first two
    this.queue.sort((a, b) => a.time - b.time);
    const p1 = this.queue.shift();
    const p2 = this.queue.shift();
    const lobby = this.createLobby(p1.playerId, { matchmade: true });
    this.joinLobby(p2.playerId, lobby.id);
    return lobby;
  }

  getLobby(playerId) {
    const lobbyId = this.players.get(playerId);
    return lobbyId ? this.lobbies.get(lobbyId) : null;
  }
}
