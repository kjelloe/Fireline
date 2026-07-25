// server/ai_difficulty.js — AI Difficulty Scaling & Behavior Trees (6D)
// Configurable AI parameters that adjust aggression, accuracy, and information.

export const DIFFICULTY_PRESETS = {
  easy:   { aggression: 0.3, accuracy: 0.5, fogCheat: false, reactionDelay: 3, microErrors: 0.3 },
  medium: { aggression: 0.6, accuracy: 0.75, fogCheat: false, reactionDelay: 2, microErrors: 0.15 },
  hard:   { aggression: 0.9, accuracy: 0.95, fogCheat: true,  reactionDelay: 1, microErrors: 0.05 },
  brutal: { aggression: 1.0, accuracy: 1.0, fogCheat: true,  reactionDelay: 0, microErrors: 0.0 }
};

export function createDifficultyConfig(presetName = 'medium') {
  const base = DIFFICULTY_PRESETS[presetName] || DIFFICULTY_PRESETS.medium;
  return { ...base, preset: presetName };
}

export function calculateAggression(baseAggression, config, gameState = {}) {
  const { playerAdvantage = 0, tickCount = 0 } = gameState;

  // Harder AI gets more aggressive when behind
  let multiplier = config.aggression;
  if (playerAdvantage > 2) multiplier += 0.15;
  if (playerAdvantage > 5) multiplier += 0.2;

  // Late-game desperation
  if (tickCount > 500) multiplier += 0.1;

  return Math.min(1.0, multiplier);
}

export function shouldCheatWithFog(config) {
  return config.fogCheat === true;
}

export function getAccuracyRoll(config) {
  // Returns true if the AI lands a shot based on accuracy config
  return Math.random() < config.accuracy;
}

export function shouldMakeMicroError(config) {
  // Returns true if the AI flubs a micro decision (pathing, targeting)
  return Math.random() < config.microErrors;
}

// Behavior Tree Node Base
class BTNode {
  tick(context) { return 'FAILURE'; }
}

export class Selector extends BTNode {
  constructor(children) {
    super();
    this.children = children;
  }
  tick(context) {
    for (const child of this.children) {
      const status = child.tick(context);
      if (status === 'SUCCESS' || status === 'RUNNING') return status;
    }
    return 'FAILURE';
  }
}

export class Sequence extends BTNode {
  constructor(children) {
    super();
    this.children = children;
  }
  tick(context) {
    for (const child of this.children) {
      const status = child.tick(context);
      if (status === 'FAILURE' || status === 'RUNNING') return status;
    }
    return 'SUCCESS';
  }
}

export class Action extends BTNode {
  constructor(fn) {
    super();
    this.fn = fn;
  }
  tick(context) {
    return this.fn(context) ? 'SUCCESS' : 'FAILURE';
  }
}

export class Condition extends BTNode {
  constructor(fn) {
    super();
    this.fn = fn;
  }
  tick(context) {
    return this.fn(context) ? 'SUCCESS' : 'FAILURE';
  }
}

export { BTNode };
