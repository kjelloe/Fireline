// server/clock.js — 10Hz authoritative server tick loop (2A)

export function startServerLoop(state, onTick) {
  const TICK_RATE_MS = 100; // 10Hz
  let currentState = state;

  const interval = setInterval(() => {
    currentState = onTick(currentState, { type: 'tick' });
  }, TICK_RATE_MS);

  return {
    stop: () => clearInterval(interval),
    getState: () => currentState,
    dispatch: (command) => {
       currentState = onTick(currentState, command);
    }
  };
}
