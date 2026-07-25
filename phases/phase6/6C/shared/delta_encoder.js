// shared/delta_encoder.js — State compression & delta updates (6A)
// Reduces network bandwidth by sending only changes between ticks.

export function encodeDelta(prevState, currentState) {
  const delta = { tick: currentState.tick, changes: [] };

  // Compare units
  const prevUnits = new Map(prevState.units.map(u => [u.id, u]));
  const currUnits = new Map(currentState.units.map(u => [u.id, u]));

  for (const [id, unit] of currUnits) {
    const prev = prevUnits.get(id);
    if (!prev) {
      delta.changes.push({ type: 'UNIT_SPAWN', data: unit });
    } else if (JSON.stringify(prev) !== JSON.stringify(unit)) {
      delta.changes.push({ type: 'UNIT_UPDATE', id, data: unit });
    }
  }

  for (const [id] of prevUnits) {
    if (!currUnits.has(id)) {
      delta.changes.push({ type: 'UNIT_DESTROY', id });
    }
  }

  return delta;
}

export function applyDelta(state, delta) {
  const newState = JSON.parse(JSON.stringify(state)); // Deep copy
  newState.tick = delta.tick;

  for (const change of delta.changes) {
    if (change.type === 'UNIT_SPAWN') {
      newState.units.push(change.data);
    } else if (change.type === 'UNIT_UPDATE') {
      const idx = newState.units.findIndex(u => u.id === change.id);
      if (idx !== -1) newState.units[idx] = change.data;
    } else if (change.type === 'UNIT_DESTROY') {
      newState.units = newState.units.filter(u => u.id !== change.id);
    }
  }

  return newState;
}
