// engine/view.js
// Fog-filtered team view adapter.
// Returns a plain object safe to send to a renderer or network client.
// Never exposes enemy positions outside fog-of-war radius.

const FOG_RADIUS_CELLS = 12; // cells visible around any friendly asset

function cellOf(fixedVal) { return (fixedVal / 256) | 0; }
function dist(ax, ay, bx, by) {
  return Math.abs(cellOf(ax) - bx) + Math.abs(cellOf(ay) - by);
}

function isVisible(state, team, cellX, cellY) {
  for (const a of state.assets) {
    if (a.team !== team) continue;
    if (a.state === 2 || a.state === 3) continue; // disabled or salvaged
    if (dist(a.x, a.y, cellX, cellY) <= FOG_RADIUS_CELLS) return true;
  }
  return false;
}

export function buildView(state, team) {
  const friendlyAssets = [];
  const visibleEnemies = [];

  for (const a of state.assets) {
    if (a.team === team) {
      friendlyAssets.push({ ...a });
    } else {
      const cx = cellOf(a.x), cy = cellOf(a.y);
      if (isVisible(state, team, cx, cy)) {
        visibleEnemies.push({ id: a.id, type: a.type, state: a.state, x: a.x, y: a.y });
      }
    }
  }

  const operators = state.operators
    .filter(o => o.team === team)
    .map(o => ({ ...o }));

  return {
    tick: state.tick,
    team,
    teamScores: [...state.teamScores],
    operators,
    friendlyAssets,
    visibleEnemies,
    events: state.events.filter(e =>
      e.type !== "rejected" ||
      state.operators[e.operatorId]?.team === team
    ),
  };
}
