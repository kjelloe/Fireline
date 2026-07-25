// client/tutorial.js — Tutorial & Onboarding Engine (7D)
// Pure step sequencer. No DOM, no I/O, no hidden state.

const DEFAULT_STEPS = [
  {
    id: 'welcome',
    message: "Welcome to More Firepower! Let's get started.",
    highlight: null,
    trigger: () => true,
    actionRequired: null
  },
  {
    id: 'select_unit',
    message: 'Click on one of your units to select it.',
    highlight: 'unit',
    trigger: (state) => state.tick >= 1,
    actionRequired: 'unit_selected'
  },
  {
    id: 'move_unit',
    message: 'Now move your unit to an adjacent cell.',
    highlight: 'move_target',
    trigger: (state) => !!state.selectedUnit,
    actionRequired: 'unit_moved'
  },
  {
    id: 'end_turn',
    message: 'Great! Press End Turn to finish your turn.',
    highlight: 'end_turn_button',
    trigger: (state) => state.unitMoved === true,
    actionRequired: 'turn_ended'
  },
  {
    id: 'complete',
    message: 'Tutorial complete! Good luck, commander.',
    highlight: null,
    trigger: (state) => state.turnEnded === true,
    actionRequired: null
  }
];

export function evaluateTrigger(step, gameState) {
  if (typeof step.trigger !== 'function') return false;
  return !!step.trigger(gameState);
}

export function createTutorial(steps = DEFAULT_STEPS) {
  if (!Array.isArray(steps) || steps.length === 0)
    throw new Error('steps must be a non-empty array');

  let currentIndex = 0;
  let completed = false;

  return {
    currentStep() {
      return completed ? null : steps[currentIndex] ?? null;
    },
    currentIndex() { return currentIndex; },
    isComplete() { return completed; },

    advance(gameState) {
      if (completed) return { advanced: false, step: null };
      const step = steps[currentIndex];
      if (!evaluateTrigger(step, gameState)) return { advanced: false, step };
      currentIndex++;
      if (currentIndex >= steps.length) {
        completed = true;
        return { advanced: true, step: null };
      }
      return { advanced: true, step: steps[currentIndex] };
    },

    idleHint(idleTicks, threshold = 20) {
      if (completed || idleTicks < threshold) return null;
      const step = steps[currentIndex];
      return step ? `Hint: ${step.message}` : null;
    },

    reset() {
      currentIndex = 0;
      completed = false;
    },

    totalSteps() { return steps.length; }
  };
}

export function isTutorialComplete(storage) {
  return storage.getItem('tutorial_complete') === 'true';
}

export function markTutorialComplete(storage) {
  storage.setItem('tutorial_complete', 'true');
}

export function resetTutorial(storage) {
  storage.setItem('tutorial_complete', 'false');
}
