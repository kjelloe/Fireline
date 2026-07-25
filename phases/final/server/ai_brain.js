// server/ai_brain.js — AI Difficulty Scaling & Behavior Trees (6D)
// Deterministic tactical evaluator. No hidden state. Difficulty is a config parameter.

const DIFFICULTIES = {
  easy:   { accuracy: 0.50, aggression: 0.20, perfectInfo: false, reactionDelay: 3 },
  normal: { accuracy: 0.75, aggression: 0.50, perfectInfo: false, reactionDelay: 1 },
  hard:   { accuracy: 0.90, aggression: 0.80, perfectInfo: true,  reactionDelay: 0 },
  expert: { accuracy: 1.00, aggression: 1.00, perfectInfo: true,  reactionDelay: 0, flank: true }
};

export class BehaviorTree {
  constructor(root) { this.root = root; }
  tick(state, aiConfig, memory) {
    return this.root.evaluate(state, aiConfig, memory);
  }
}

export class Selector {
  constructor(children) { this.children = children; }
  evaluate(state, aiConfig, memory) {
    for (const child of this.children) {
      const result = child.evaluate(state, aiConfig, memory);
      if (result.status !== 'FAILURE') return result;
    }
    return { status: 'FAILURE' };
  }
}

export class Sequence {
  constructor(children) { this.children = children; }
  evaluate(state, aiConfig, memory) {
    let lastResult = { status: 'SUCCESS' };
    for (const child of this.children) {
      const result = child.evaluate(state, aiConfig, memory);
      if (result.status !== 'SUCCESS') return result;
      lastResult = result; // Propagate the last successful child's payload
    }
    return lastResult;
  }
}

export class Action {
  constructor(name, fn) { this.name = name; this.fn = fn; }
  evaluate(state, aiConfig, memory) {
    return this.fn(state, aiConfig, memory);
  }
}

export class Inverter {
  constructor(child) { this.child = child; }
  evaluate(state, aiConfig, memory) {
    const result = this.child.evaluate(state, aiConfig, memory);
    if (result.status === 'SUCCESS') return { status: 'FAILURE' };
    if (result.status === 'FAILURE') return { status: 'SUCCESS' };
    return result;
  }
}

export function buildTacticalAI(difficultyKey) {
  const config = DIFFICULTIES[difficultyKey];
  if (!config) throw new Error(`Unknown difficulty: ${difficultyKey}`);

  return new BehaviorTree(
    new Selector([
      // Expert: try flanking if possible
      new Sequence([
        new Action('isExpert', (s, c) => c.flank ? { status: 'SUCCESS' } : { status: 'FAILURE' }),
        new Action('flank', (s, c, m) => {
          m.lastAction = 'flank';
          return { status: 'SUCCESS', command: { type: 'FLANK', target: findWeakestEnemy(s, c.perfectInfo) } };
        })
      ]),
      // Hard+: attack if enemy visible
      new Sequence([
        new Action('seesEnemy', (s, c) => {
          const enemies = c.perfectInfo ? allEnemies(s) : visibleEnemies(s);
          return enemies.length > 0 ? { status: 'SUCCESS' } : { status: 'FAILURE' };
        }),
        new Action('attack', (s, c, m) => {
          const enemies = c.perfectInfo ? allEnemies(s) : visibleEnemies(s);
          if (enemies.length === 0) return { status: 'FAILURE' };
          const target = pickTarget(enemies, c.accuracy);
          m.lastAction = 'attack';
          return { status: 'SUCCESS', command: { type: 'ATTACK', targetId: target.id } };
        })
      ]),
      // Normal: advance if safe
      new Sequence([
        new Action('isSafe', (s, c) => {
          const enemies = c.perfectInfo ? allEnemies(s) : visibleEnemies(s);
          return (enemies.length === 0 || c.aggression < 0.6) ? { status: 'SUCCESS' } : { status: 'FAILURE' };
        }),
        new Action('advance', (s, c, m) => {
          m.lastAction = 'advance';
          return { status: 'SUCCESS', command: { type: 'MOVE', dx: 0, dy: 1 } };
        })
      ]),
      // Fallback: hold
      new Action('hold', (s, c, m) => {
        m.lastAction = 'hold';
        return { status: 'SUCCESS', command: { type: 'HOLD' } };
      })
    ])
  );
}

export function evaluateDifficulty(difficultyKey, state, memory = {}) {
  const ai = buildTacticalAI(difficultyKey);
  return ai.tick(state, DIFFICULTIES[difficultyKey], memory);
}

export { DIFFICULTIES };

// ── Internal helpers (pure, deterministic) ──────────────────────────────────────────

function allEnemies(state) {
  return (state.enemies || []).filter(e => e.hp > 0);
}

function visibleEnemies(state) {
  return (state.enemies || []).filter(e => e.hp > 0 && e.visible);
}

function findWeakestEnemy(state, perfectInfo) {
  const pool = perfectInfo ? allEnemies(state) : visibleEnemies(state);
  return pool.sort((a, b) => a.hp - b.hp)[0] || null;
}

function pickTarget(enemies, accuracy) {
  // Accuracy affects target selection quality: low accuracy picks randomly
  if (accuracy < 0.6) return enemies[Math.floor(Math.random() * enemies.length)];
  // Higher accuracy picks the most dangerous (highest threat)
  return enemies.sort((a, b) => b.threat - a.threat)[0];
}
