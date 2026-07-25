// server/replay_store.js — Match history and replay indexing (5A)
// Persists match data to disk for later viewing.

import fs from 'fs';
import path from 'path';

const REPLAY_DIR = path.join(process.cwd(), 'replays');
const INDEX_FILE = path.join(REPLAY_DIR, 'replay_index.json');

// Ensure directory exists
if (!fs.existsSync(REPLAY_DIR)) fs.mkdirSync(REPLAY_DIR);

export function saveReplay(matchId, state, commandLog) {
  const winner = state.victory?.winner !== undefined ? state.victory.winner : 'draw';

  const replayData = {
    matchId,
    timestamp: new Date().toISOString(),
    finalState: state,
    commandLog: commandLog,
    winner: winner
  };

  const filePath = path.join(REPLAY_DIR, `${matchId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(replayData, null, 2));

  updateIndex(matchId, replayData);
}

function updateIndex(matchId, data) {
  let index = [];
  if (fs.existsSync(INDEX_FILE)) {
    index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  }

  index.push({
    matchId,
    timestamp: data.timestamp,
    winner: data.winner,
    mapSeed: data.finalState.seed
  });

  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

export function getReplayIndex() {
  if (!fs.existsSync(INDEX_FILE)) return [];
  return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
}

export function loadReplay(matchId) {
  const filePath = path.join(REPLAY_DIR, `${matchId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
