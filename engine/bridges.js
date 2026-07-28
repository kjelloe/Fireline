// engine/bridges.js — 13E bridge demolition (specs/11_bridge_demolition.md).
// Riverline's three crossings become droppable and rebuildable: the
// losing team can break the winning team's momentum, and the winner must
// bring a truck, take a longer crossing, or send Skimmers.
//
// Bridges are NOT sites (see specs/11 for why: 24 call sites iterate
// .sites, including supply projection and relay fog — a bridge must
// project neither). They are terrain with hit points: hashed {id, hp},
// with geometry as a per-profile CONSTANT that is never hashed.
//
// The terrain effect deliberately reuses the existing vocabulary rather
// than inventing a "broken bridge" cell: a breached span becomes WATER.
// Heavy hulls ford it in misery; the amphibious Skimmer crosses at
// speed, which hands the Outliers a real answer to a demolition.

const T_ROAD = 1;
const T_WATER = 6;

export const BRIDGE_HP_MAX = 120; // twice a relay: a committed effort, not a lucky shell

// Per-profile spans, hand-derived from the map constants. Each entry is
// the inclusive row span crossed with the river columns. Profiles absent
// here have NO bridges, so every other map is inert (the 18B/18E shape).
const BRIDGE_SPANS = Object.freeze({
  riverline: Object.freeze([
    Object.freeze({ rows: [20, 23], cols: [60, 67] }),
    Object.freeze({ rows: [62, 65], cols: [60, 67] }), // the main road crossing
    Object.freeze({ rows: [104, 107], cols: [60, 67] }),
  ]),
});

export function bridgeSpans(profile) {
  return BRIDGE_SPANS[profile] ?? [];
}

export function createBridges(profile) {
  return bridgeSpans(profile).map((_, id) => ({ id, hp: BRIDGE_HP_MAX }));
}

export function bridgeIntact(bridge) {
  return (bridge?.hp ?? 0) > 0;
}

// Every cell of a span, in a stable order (row-major) so any iteration
// over it is deterministic.
export function bridgeCells(profile, id) {
  const span = bridgeSpans(profile)[id];
  if (!span) return [];
  const cells = [];
  for (let y = span.rows[0]; y <= span.rows[1]; y++) {
    for (let x = span.cols[0]; x <= span.cols[1]; x++) cells.push([x, y]);
  }
  return cells;
}

// Which bridge covers this cell, or -1. Used by the repair pass (a truck
// must be beside a span) and by tests.
export function bridgeAtCell(profile, cellX, cellY) {
  const spans = bridgeSpans(profile);
  for (let id = 0; id < spans.length; id++) {
    const s = spans[id];
    if (cellY >= s.rows[0] && cellY <= s.rows[1] &&
        cellX >= s.cols[0] && cellX <= s.cols[1]) return id;
  }
  return -1;
}

// Is an asset standing next to (or on) the span? Chebyshev 1, matching
// the site-repair reach.
export function adjacentToBridge(profile, id, cellX, cellY) {
  const span = bridgeSpans(profile)[id];
  if (!span) return false;
  return cellX >= span.cols[0] - 1 && cellX <= span.cols[1] + 1 &&
         cellY >= span.rows[0] - 1 && cellY <= span.rows[1] + 1;
}

// The terrain mutation. A pure function of hashed bridge hp, so replays
// stay honest even though map.cells is not itself hashed: the same
// commands rebuild the same terrain.
export function applyBridgeTerrain(map, profile, id, intact) {
  for (const [x, y] of bridgeCells(profile, id)) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    map.cells[y * map.width + x] = intact ? T_ROAD : T_WATER;
  }
}

// 13D reuse: a breached span's cells become hazards for the route graph,
// so waypoint chains route around the gap instead of driving into water.
// Sampled at the span's midpoint per breached bridge — the graph's
// hazard test already has a radius, and a whole span of points would
// only cost time.
export function breachedHazards(state) {
  const out = [];
  for (const b of state.bridges ?? []) {
    if (bridgeIntact(b)) continue;
    const span = bridgeSpans(state.mapProfile)[b.id];
    if (!span) continue;
    out.push([(span.cols[0] + span.cols[1]) >> 1, (span.rows[0] + span.rows[1]) >> 1]);
    out.push([(span.cols[0] + span.cols[1] + 1) >> 1, (span.rows[0] + span.rows[1] + 1) >> 1]);
  }
  return out;
}
