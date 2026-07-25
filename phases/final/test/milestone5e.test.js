// test/milestone5e.test.js — Milestone 5E: Matchmaking & Lobbies
import { test } from 'node:test';
import assert from 'node:assert';
import { LobbyManager } from '../server/lobby_manager.js';

test('5E can create a lobby and join it', () => {
  const mgr = new LobbyManager();
  const lobby = mgr.createLobby('host_1');
  assert.ok(lobby.id.startsWith('lobby_'));
  assert.strictEqual(lobby.players.length, 1);

  const joined = mgr.joinLobby('guest_1', lobby.id);
  assert.strictEqual(joined.players.length, 2);
});

test('5E cannot join a started lobby', () => {
  const mgr = new LobbyManager();
  const lobby = mgr.createLobby('host_1');
  mgr.setReady('host_1', true);
  mgr.joinLobby('guest_1', lobby.id);
  mgr.setReady('guest_1', true);
  mgr.startMatch(lobby.id);

  const result = mgr.joinLobby('late_1', lobby.id);
  assert.strictEqual(result, null);
});

test('5E match starts only when all players are ready', () => {
  const mgr = new LobbyManager();
  const lobby = mgr.createLobby('host_1');
  mgr.joinLobby('guest_1', lobby.id);

  assert.strictEqual(mgr.canStart(lobby.id), false);
  mgr.setReady('host_1', true);
  assert.strictEqual(mgr.canStart(lobby.id), false);
  mgr.setReady('guest_1', true);
  assert.strictEqual(mgr.canStart(lobby.id), true);

  const started = mgr.startMatch(lobby.id);
  assert.strictEqual(started.started, true);
});

test('5E matchmaking pairs two queued players', () => {
  const mgr = new LobbyManager();
  const lobby = mgr.queueForMatch('player_a');
  assert.strictEqual(lobby, null); // Need 2 players

  const lobby2 = mgr.queueForMatch('player_b');
  assert.ok(lobby2);
  assert.strictEqual(lobby2.players.length, 2);
  assert.ok(lobby2.options.matchmade);
});
