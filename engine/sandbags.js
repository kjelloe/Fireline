// engine/sandbags.js — Q45/Q50 player-built cover (designer table,
// specs/12, + the owner's prompt-115 cap: "limited per building unit,
// cannot block more than two lanes").
//
// A TRUCK builds a sandbag wall on an adjacent cell: 5 s channel (the
// truck must stay beside the work), then the cell becomes impassable
// (the 18B wall rule handles refusal and slides for free). Destroyable
// by any gun; destruction restores the original ground. The placement
// LAW is what keeps the map honest:
//   - never on roads, trails or water (routes can be SHAPED by walls
//     beside them, never severed — stricter than the ruled two-lane
//     cap, and provably map-safe);
//   - never inside any base rect (spawn exits and gates live there),
//     never on a site, prison, standard home or mission gate;
//   - a build may not join a contiguous run longer than
//     SANDBAG_MAX_RUN cells (the two-lane cap made checkable);
//   - racks of SANDBAGS_PER_TRUCK, team total capped live.

import { T_OPEN, T_ROUGH, T_FOREST, T_ROAD } from "./mapgen.js";

export const SANDBAG_HP = 40;
export const SANDBAGS_PER_TRUCK = 2;
export const SANDBAG_TEAM_CAP = 6;
export const SANDBAG_BUILD_TICKS = 50; // 5 s beside the work
export const SANDBAG_MAX_RUN = 4;      // the owner's two-lane cap

// Q53 (prompt 145): ROADS are buildable up to the TWO-LANE law — a
// build on a road must leave at least 2 open road cells in that
// road's cross-section (the vertical span of contiguous road through
// this column). The run cap alone could not guarantee it: a 4-run
// laid vertically severs a 4-row road outright. Trails/water stay
// forbidden (routes shaped, never severed).
const BUILDABLE = new Set([T_OPEN, T_ROUGH, T_FOREST, T_ROAD]);

export function sandbagAt(state, cellX, cellY) {
  return (state.sandbags ?? []).find((s) => s.cellX === cellX && s.cellY === cellY) ?? null;
}

// Orthogonally-contiguous sandbag run that a build at (cellX, cellY)
// would join (counts existing bags, built or building).
export function runLengthWith(state, cellX, cellY) {
  const cells = new Set((state.sandbags ?? []).map((s) => `${s.cellX},${s.cellY}`));
  cells.add(`${cellX},${cellY}`);
  const seen = new Set();
  const stack = [`${cellX},${cellY}`];
  while (stack.length) {
    const key = stack.pop();
    if (seen.has(key)) continue;
    seen.add(key);
    const [x, y] = key.split(",").map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (cells.has(k) && !seen.has(k)) stack.push(k);
    }
  }
  return seen.size;
}

// Prompt 232: each PLAYER may keep at most 5 bags STANDING — a
// destroyed bag frees the slot (the wall is a position, not a carpet).
export const SANDBAG_OPERATOR_CAP = 5;

export function buildRejection(state, truck, stats, cellX, cellY) {
  if (!stats.canClearMines) return "only a truck builds sandbags";
  if ((truck.sandbagsLeft ?? 0) <= 0) return "sandbag rack empty";
  const mine = (state.sandbags ?? []).filter(
    (s) => s.byOperator === truck.operatorId).length;
  if (mine >= SANDBAG_OPERATOR_CAP) return "your 5-bag limit is standing";
  if (cellX < 0 || cellY < 0 || cellX >= state.map.width || cellY >= state.map.height) {
    return "off the map";
  }
  const terrain = state.map.cells[cellY * state.map.width + cellX];
  if (!BUILDABLE.has(terrain)) return "cannot build on this ground";
  if (sandbagAt(state, cellX, cellY)) return "sandbags already here";
  const live = (state.sandbags ?? []).filter((s) => s.team === truck.team).length;
  if (live >= SANDBAG_TEAM_CAP) return "team sandbag limit reached";
  if (runLengthWith(state, cellX, cellY) > SANDBAG_MAX_RUN) {
    return "wall run too long";
  }
  if (terrain === T_ROAD) {
    // The two-lane law, column-local (mirror-inert: pure y-scan).
    const W = state.map.width;
    let top = cellY;
    while (top > 0 && state.map.cells[(top - 1) * W + cellX] === T_ROAD) top--;
    let bot = cellY;
    while (bot < state.map.height - 1 && state.map.cells[(bot + 1) * W + cellX] === T_ROAD) bot++;
    let open = 0;
    for (let y = top; y <= bot; y++) {
      if (y === cellY) continue; // this build takes the cell
      if (!sandbagAt(state, cellX, y)) open++;
    }
    if (open < 2) return "the road must keep two lanes";
  }
  const inAnyBase = state.bases.some(
    (b) => cellX >= b.x && cellX < b.x + b.width &&
           cellY >= b.y && cellY < b.y + b.height
  );
  if (inAnyBase) return "cannot build in a base zone";
  if (state.sites.some((s) => s.cellX === cellX && s.cellY === cellY)) {
    return "cannot build on a site";
  }
  if ((state.prisons ?? []).some((p) =>
    Math.abs(p.cellX - cellX) <= 1 && Math.abs(p.cellY - cellY) <= 1)) {
    return "cannot build at a prison";
  }
  if ((state.standards ?? []).some((st) =>
    st.homeCellX === cellX && st.homeCellY === cellY)) {
    return "cannot build on a standard home";
  }
  if (state.mission &&
      Math.abs(state.mission.gateCellX - cellX) <= 1 &&
      Math.abs(state.mission.gateCellY - cellY) <= 1) {
    return "cannot build at the extraction gate";
  }
  return null;
}
