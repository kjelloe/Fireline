// server/achievements.js — Achievement & Progression System (7C)
// Rules-based achievement evaluator and player progress manager.

/**
 * Registry of possible achievements.
 * Each has logic to evaluate against match state.
 */
export const ACHIEVEMENT_REGISTRY = [
  {
    id: 'first_blood',
    name: 'First Blood',
    desc: 'Destroy your first enemy unit.',
    evaluate: (matchState, playerId) => {
      const stats = matchState.playerStats?.[playerId] || {};
      return (stats.kills || 0) >= 1;
    }
  },
  {
    id: 'flawless_victory',
    name: 'Flawless Victory',
    desc: 'Win a match without losing any units.',
    evaluate: (matchState, playerId) => {
      const stats = matchState.playerStats?.[playerId] || {};
      return matchState.winner === playerId && (stats.losses || 0) === 0;
    }
  },
  {
    id: 'pacifist',
    name: 'Pacifist',
    desc: 'Win a match with 0 kills.',
    evaluate: (matchState, playerId) => {
      const stats = matchState.playerStats?.[playerId] || {};
      return matchState.winner === playerId && (stats.kills || 0) === 0;
    }
  }
];

/**
 * Check match state for new achievements.
 * Returns array of achievement IDs newly unlocked.
 */
export function evaluateAchievements(matchState, playerId, currentAchievementIds = []) {
  const unlocked = [];
  const existingSet = new Set(currentAchievementIds);

  for (const ach of ACHIEVEMENT_REGISTRY) {
    if (existingSet.has(ach.id)) continue;
    if (ach.evaluate(matchState, playerId)) {
      unlocked.push(ach.id);
    }
  }
  return unlocked;
}

/**
 * Pure function to calculate player tier based on total match count/wins.
 */
export function calculatePlayerTier(totalWins) {
  if (totalWins >= 100) return 'Gold';
  if (totalWins >= 25) return 'Silver';
  if (totalWins >= 5) return 'Bronze';
  return 'Recruit';
}

/**
 * Factory for a player profile state object (for modding/persistence).
 */
export function createPlayerProfile(id, name) {
  return {
    id,
    name,
    wins: 0,
    matches: 0,
    achievements: [], // Array of { id, unlockedAt }
    tier: 'Recruit'
  };
}

/**
 * Update profile with match results.
 */
export function updateProfileWithMatch(profile, isWinner, newAchIds, timestamp = Date.now()) {
  const next = JSON.parse(JSON.stringify(profile));
  next.matches += 1;
  if (isWinner) next.wins += 1;

  for (const aid of newAchIds) {
    if (!next.achievements.find(a => a.id === aid)) {
      next.achievements.push({ id: aid, unlockedAt: timestamp });
    }
  }

  next.tier = calculatePlayerTier(next.wins);
  return next;
}
