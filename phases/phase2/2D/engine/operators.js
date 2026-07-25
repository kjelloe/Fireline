// engine/operators.js — No-lobby multi-role join logic (2A)

export function joinWorld(state, operatorId, team) {
  const existing = state.operators.find(o => o.id === operatorId);
  if (existing) return state;

  const next = {
    ...state,
    operators: [
      ...state.operators,
      { id: operatorId, team: team }
    ]
  };
  return next;
}
