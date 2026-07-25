// server/campaign.js — Campaign Mode (5D)
// Mission-based progression with unlockable maps and difficulty scaling.

import fs from 'fs';
import path from 'path';

const CAMPAIGN_FILE = path.join(process.cwd(), 'data', 'campaign_progress.json');

const MISSIONS = [
  { id: 'm1', name: 'The Valley',    biome: 'temperate', winCondition: 'annihilation', unlock: 'm2' },
  { id: 'm2', name: 'Frozen Pass',   biome: 'arctic',    winCondition: 'survival50',   unlock: 'm3' },
  { id: 'm3', name: 'Sandstorm',     biome: 'desert',    winCondition: 'domination',   unlock: 'm4' },
  { id: 'm4', name: 'The Capital',   biome: 'temperate', winCondition: 'captureHQ',    unlock: null }
];

export function getCampaignProgress(playerId) {
  if (!fs.existsSync(CAMPAIGN_FILE)) return { playerId, unlocked: ['m1'], completed: [] };
  const all = JSON.parse(fs.readFileSync(CAMPAIGN_FILE, 'utf8'));
  return all[playerId] || { playerId, unlocked: ['m1'], completed: [] };
}

export function saveCampaignProgress(playerId, missionId, won) {
  if (!won) return getCampaignProgress(playerId);

  const all = fs.existsSync(CAMPAIGN_FILE) ? JSON.parse(fs.readFileSync(CAMPAIGN_FILE, 'utf8')) : {};
  const progress = all[playerId] || { playerId, unlocked: ['m1'], completed: [] };

  if (!progress.completed.includes(missionId)) {
    progress.completed.push(missionId);
  }

  const mission = MISSIONS.find(m => m.id === missionId);
  if (mission && mission.unlock && !progress.unlocked.includes(mission.unlock)) {
    progress.unlocked.push(mission.unlock);
  }

  all[playerId] = progress;
  fs.writeFileSync(CAMPAIGN_FILE, JSON.stringify(all, null, 2));
  return progress;
}

export function getMission(missionId) {
  return MISSIONS.find(m => m.id === missionId) || null;
}

export function getAllMissions() {
  return MISSIONS;
}

export { MISSIONS };
