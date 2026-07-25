// server/player_store.js — Player identity and persistence (5B)
// Tracks stats and profiles across sessions.

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'player_profiles.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

export function getProfile(playerId) {
  const profiles = loadAll();
  return profiles[playerId] || {
    playerId,
    wins: 0,
    losses: 0,
    matchesPlayed: 0,
    lastSeen: new Date().toISOString()
  };
}

export function updateStats(playerId, won) {
  const profiles = loadAll();
  const p = getProfile(playerId);

  p.matchesPlayed += 1;
  if (won) p.wins += 1;
  else p.losses += 1;
  p.lastSeen = new Date().toISOString();

  profiles[playerId] = p;
  saveAll(profiles);
  return p;
}

function loadAll() {
  if (!fs.existsSync(PROFILES_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveAll(profiles) {
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
}

export function getLeaderboard(limit = 10) {
  const profiles = Object.values(loadAll());
  return profiles
    .sort((a, b) => b.wins - a.wins)
    .slice(0, limit);
}
