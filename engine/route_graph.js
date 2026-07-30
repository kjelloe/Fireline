// engine/route_graph.js — 13C: the route graph (plan-wave3 Track G).
// Per-profile node/edge tables hand-derived from the LAYOUT constants
// (roads, trails, bridges, relays, base exits — all static per profile;
// only rough/forest scatter is seeded, and the graph doesn't care).
// Deterministic Dijkstra with per-chassis edge costs. The first consumer
// is AI movement: waypoint chains replace straight lines, which finally
// ends cross-country fording (the riverline east-edge traffic pattern).
//
// MIRROR INVARIANT: every node has its x-mirror partner (x' = 127-x) and
// every edge its mirrored edge — tested, like the patrol tables.

import { absI32 } from "../shared/fixedmath.js";

// Cost per cell by edge tag and chassis class. Integers, ~inverse speed.
const COST = Object.freeze({
  road: Object.freeze({ light: 7, heavy: 7 }),
  trail: Object.freeze({ light: 8, heavy: 20 }),
  open: Object.freeze({ light: 10, heavy: 10 }),
});
// Cross-country estimate per cell — worse than open because the seeded
// rough/forest scatter is in the way. Routing wins when it beats this.
const DIRECT_COST = 13;
// Water barriers per profile: straddling the band means a direct drive
// FORDS it — price that honestly (water 40/cell vs open 10, 8 cells wide)
// or the estimate makes bridges look like a detour never worth taking.
const BARRIERS = Object.freeze({
  riverline: Object.freeze({ x0: 60, x1: 67, penalty: (40 - 10) * 8 }),
});
const DIRECT_SKIP_CELLS = 14; // short hops don't bother with the graph
const WAYPOINT_DONE_CELLS = 2; // a waypoint this close counts as reached
// 13D dynamic edges: a KNOWN hazard (marked enemy mine) near an edge
// makes it DANGEROUS — cost x4. Mine play becomes area denial: the AI
// routes around what its scouts have marked instead of driving into it.
const HAZARD_CELLS = 2;
const HAZARD_COST_MULT = 4;

// n: [x, y] cells. e: [a, b, tag]. Tables are mirror-closed.
const GRAPHS = Object.freeze({
  frontier_corridor: Object.freeze({
    n: [
      [24, 63], [103, 63],                       // 0 A-exit, 1 B-exit
      [32, 63], [58, 63], [69, 63], [95, 63],    // 2-5 road relays
      [24, 40], [58, 40], [69, 40], [103, 40],   // 6-9 north trail
      [24, 86], [58, 86], [69, 86], [103, 86],   // 10-13 south trail
      [44, 40], [83, 40], [44, 86], [83, 86],    // 14-17 lateral relays (prompt 51)
    ],
    e: [
      [0, 2, "road"], [2, 3, "road"], [3, 4, "road"], [4, 5, "road"], [5, 1, "road"],
      [6, 14, "trail"], [14, 7, "trail"], [7, 8, "trail"], [8, 15, "trail"], [15, 9, "trail"],
      [10, 16, "trail"], [16, 11, "trail"], [11, 12, "trail"], [12, 17, "trail"], [17, 13, "trail"],
      [0, 6, "open"], [0, 10, "open"], [1, 9, "open"], [1, 13, "open"],
      [6, 2, "open"], [9, 5, "open"], [10, 2, "open"], [13, 5, "open"],
      [7, 3, "open"], [8, 4, "open"], [11, 3, "open"], [12, 4, "open"],
    ],
  }),
  riverline: Object.freeze({
    n: [
      [24, 63], [103, 63],                       // 0 A-exit, 1 B-exit
      [44, 32], [83, 32], [44, 95], [83, 95],    // 2-5 outer relays
      [58, 63], [69, 63],                        // 6-7 bridge relays
      [44, 63], [83, 63],                        // 8-9 trail-road junctions
      [59, 21], [68, 21], [59, 105], [68, 105],  // 10-13 outer bridge ends
    ],
    e: [
      [0, 8, "road"], [8, 6, "road"], [6, 7, "road"], [7, 9, "road"], [9, 1, "road"],
      [8, 2, "trail"], [8, 4, "trail"], [9, 3, "trail"], [9, 5, "trail"],
      [2, 10, "open"], [10, 11, "road"], [11, 3, "open"],
      [4, 12, "open"], [12, 13, "road"], [13, 5, "open"],
    ],
  }),
  blackwood: Object.freeze({
    // 18A: one road, a trail ring, twin center alleys. "open" here means
    // WOODS — the honest cross-country price keeps hulls on the network.
    n: [
      [24, 63], [103, 63],                       // 0 A-exit, 1 B-exit
      [36, 63], [91, 63],                        // 2-3 ring-road junctions
      [58, 63], [69, 63],                        // 4-5 alley-road junctions
      [36, 28], [91, 28], [36, 99], [91, 99],    // 6-9 ring corner relays
      [58, 28], [69, 28], [58, 99], [69, 99],    // 10-13 ring mid points
      [58, 45], [69, 45], [58, 82], [69, 82],    // 14-17 deep-woods relays
      [36, 45], [91, 45], [36, 82], [91, 82],    // 18-21 logging-road ring junctions (18G)
    ],
    e: [
      [0, 2, "road"], [2, 4, "road"], [4, 5, "road"], [5, 3, "road"], [3, 1, "road"],
      [6, 10, "trail"], [10, 11, "trail"], [11, 7, "trail"],
      [8, 12, "trail"], [12, 13, "trail"], [13, 9, "trail"],
      [6, 2, "trail"], [2, 8, "trail"], [7, 3, "trail"], [3, 9, "trail"],
      [14, 4, "trail"], [4, 16, "trail"], [15, 5, "trail"], [5, 17, "trail"],
      [10, 14, "open"], [11, 15, "open"], [12, 16, "open"], [13, 17, "open"],
      // 18G logging roads: the deep-woods relays reach the ring LATERALLY
      // on trail, so a tow's route home can skirt the central crossfire.
      [18, 14, "trail"], [14, 15, "trail"], [15, 19, "trail"],
      [20, 16, "trail"], [16, 17, "trail"], [17, 21, "trail"],
      [6, 18, "trail"], [18, 2, "trail"], [7, 19, "trail"], [19, 3, "trail"],
      [2, 20, "trail"], [20, 8, "trail"], [3, 21, "trail"], [21, 9, "trail"],
    ],
  }),
  caldera: Object.freeze({
    // Item 40: the ring is the ROAD, the centre is the TRAIL — the
    // route-choice triangle. Gate joints sit where the ring columns
    // meet each base's side gates; the centre chain runs exit-to-exit.
    n: [
      [24, 63], [103, 63],                       // 0-1 A/B front exits (trail)
      [14, 54], [14, 73], [113, 54], [113, 73],  // 2-5 side-gate joints
      [14, 30], [113, 30], [14, 97], [113, 97],  // 6-9 ring corners
      [58, 30], [69, 30], [58, 97], [69, 97],    // 10-13 ring relays
      [58, 63], [69, 63],                        // 14-15 centre relays
    ],
    e: [
      [0, 14, "trail"], [14, 15, "trail"], [15, 1, "trail"],
      [2, 6, "road"], [3, 8, "road"], [4, 7, "road"], [5, 9, "road"],
      [6, 10, "road"], [10, 11, "road"], [11, 7, "road"],
      [8, 12, "road"], [12, 13, "road"], [13, 9, "road"],
      [2, 3, "road"], [4, 5, "road"], // the gate columns through each base flank
      [0, 2, "open"], [0, 3, "open"], [1, 4, "open"], [1, 5, "open"],
    ],
  }),
  sawtooth: Object.freeze({
    // 18B: three lanes, four gaps, two edge corridors. The gaps are
    // tagged trail (they ARE T_PATH); the edge corridors are honest
    // long "open" detours — the graph only takes them when the gaps
    // are hazard-marked, which is exactly when they should shine (13D).
    n: [
      [24, 63], [103, 63],                       // 0 A-exit, 1 B-exit
      [58, 63], [69, 63],                        // 2-3 canyon heart relays
      [42, 63], [85, 63],                        // 4-5 gap-road junctions
      [42, 46], [85, 46],                        // 6-7 north gap centers
      [42, 82], [85, 82],                        // 8-9 south gap centers
      [44, 34], [83, 34],                        // 10-11 north lane relays (18C)
      [44, 93], [83, 93],                        // 12-13 south lane relays (18C)
      [12, 34], [115, 34],                       // 14-15 edge corridor north
      [12, 93], [115, 93],                       // 16-17 edge corridor south
    ],
    e: [
      [0, 4, "road"], [4, 2, "road"], [2, 3, "road"], [3, 5, "road"], [5, 1, "road"],
      [4, 6, "trail"], [6, 10, "trail"], [5, 7, "trail"], [7, 11, "trail"],
      [4, 8, "trail"], [8, 12, "trail"], [5, 9, "trail"], [9, 13, "trail"],
      [10, 11, "open"], [12, 13, "open"],
      [0, 14, "open"], [14, 10, "open"], [1, 15, "open"], [15, 11, "open"],
      [0, 16, "open"], [16, 12, "open"], [1, 17, "open"], [17, 13, "open"],
    ],
  }),
});

function cheb(ax, ay, bx, by) {
  return Math.max(absI32(ax - bx), absI32(ay - by));
}

function classOf(stats) {
  return stats?.heavy ? "heavy" : "light";
}

// Adjacency with per-class integer costs, built once per profile+class.
const built = new Map();
function graphFor(profile, cls) {
  const key = `${profile}:${cls}`;
  if (built.has(key)) return built.get(key);
  const src = GRAPHS[profile];
  if (!src) return null;
  const adj = src.n.map(() => []);
  for (const [a, b, tag] of src.e) {
    const [ax, ay] = src.n[a];
    const [bx, by] = src.n[b];
    const cost = cheb(ax, ay, bx, by) * COST[tag][cls];
    adj[a].push([b, cost]);
    adj[b].push([a, cost]);
  }
  const g = { nodes: src.n, adj };
  built.set(key, g);
  return g;
}

// TIE-BREAKS MUST COMMUTE WITH THE MIRROR (the frontier A-edge lesson:
// lowest-node-id ties attached west units to their OUTER trail end and
// east units to their INNER one — a west-favoring chirality worth ~8pts).
// |2x-127| is invariant under x' = 127-x, so "prefer the node farther
// off the center axis, then farther off the horizontal axis" picks
// mirror-partner nodes in mirror worlds. Ids only break exact-rank ties
// (mirror-pair options seen from the axis itself — unavoidable, rare).
function rankBetter(g, a, b, originSide = 0) {
  if (b === -1) return true;
  const [ax, ay] = g.nodes[a];
  const [bx, by] = g.nodes[b];
  const axr = Math.abs(2 * ax - 127);
  const bxr = Math.abs(2 * bx - 127);
  if (axr !== bxr) return axr > bxr;
  const ayr = Math.abs(2 * ay - 127);
  const byr = Math.abs(2 * by - 127);
  if (ayr !== byr) return ayr > byr;
  // Exact-rank ties are MIRROR PARTNERS (e.g. the two bridge relays) — no
  // node-keyed rule is equivariant there, but a TRIP-keyed one is: prefer
  // the candidate on the trip origin's side of the axis. The mirror flips
  // both, so mirrored trips make mirrored choices.
  if (originSide !== 0) {
    const aSide = Math.sign(2 * ax - 127) === originSide;
    const bSide = Math.sign(2 * bx - 127) === originSide;
    if (aSide !== bSide) return aSide;
  }
  return a < b;
}

// Deterministic Dijkstra (stable O(n^2) scan — the graphs are ~14 nodes);
// every cost tie resolves through rankBetter so routes mirror exactly.
function dijkstra(g, from, originSide = 0) {
  const n = g.nodes.length;
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const done = new Array(n).fill(false);
  dist[from] = 0;
  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (done[i] || dist[i] === Infinity) continue;
      if (u === -1 || dist[i] < dist[u] || (dist[i] === dist[u] && rankBetter(g, i, u, originSide))) u = i;
    }
    if (u === -1) break;
    done[u] = true;
    for (const [v, w] of g.adj[u]) {
      const alt = dist[u] + w;
      if (alt < dist[v] || (alt === dist[v] && rankBetter(g, u, prev[v], originSide))) {
        dist[v] = alt;
        prev[v] = u;
      }
    }
  }
  return { dist, prev };
}

function nearestNode(g, x, y, originSide = 0) {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < g.nodes.length; i++) {
    const d = cheb(x, y, g.nodes[i][0], g.nodes[i][1]);
    if (d < bestD || (d === bestD && rankBetter(g, i, best, originSide))) { bestD = d; best = i; }
  }
  return { id: best, d: bestD };
}

function nearHazard(hazards, x, y) {
  for (const [hx, hy] of hazards) {
    if (Math.max(absI32(hx - x), absI32(hy - y)) <= HAZARD_CELLS) return true;
  }
  return false;
}

function hazardOverlay(g, hazards) {
  const adj = g.adj.map((edges, a) => edges.map(([b, cost]) => {
    const [ax, ay] = g.nodes[a];
    const [bx, by] = g.nodes[b];
    // Midpoints sample BOTH floor and ceil: a single >>1 midpoint is
    // off-by-one under the mirror (the homeCellFor lesson) and skewed
    // rerouting ~9 pts side-ward in the first 13D battery. The
    // floor/ceil PAIR mirrors onto itself.
    const mx1 = (ax + bx) >> 1;
    const mx2 = (ax + bx + 1) >> 1;
    const my1 = (ay + by) >> 1;
    const my2 = (ay + by + 1) >> 1;
    const dangerous = nearHazard(hazards, ax, ay) ||
      nearHazard(hazards, bx, by) ||
      nearHazard(hazards, mx1, my1) || nearHazard(hazards, mx2, my2);
    return [b, dangerous ? cost * HAZARD_COST_MULT : cost];
  }));
  return { nodes: g.nodes, adj };
}

// The public API: waypoint cells from (fromX,fromY) to (toX,toY) for a
// chassis, or [] when driving straight is the right call (short hop,
// amphibious hull, unknown profile, or the graph doesn't actually help).
export function routeWaypoints(profile, fromX, fromY, toX, toY, stats, hazards = []) {
  if (stats?.amphibious) return []; // the river IS the Skimmer's road
  const direct = cheb(fromX, fromY, toX, toY);
  if (direct < DIRECT_SKIP_CELLS) return [];
  const g0 = graphFor(profile, classOf(stats));
  if (!g0) return [];
  // 13D: overlay hazard penalties per query (the graphs are tiny). An
  // edge is dangerous when a known hazard sits within HAZARD_CELLS of
  // either endpoint or the midpoint — symmetric sampling, so mirrored
  // hazards produce mirrored penalties.
  const g = hazards.length ? hazardOverlay(g0, hazards) : g0;
  const originSide = Math.sign(2 * fromX - 127) || 1;
  const nf = nearestNode(g, fromX, fromY, originSide);
  const nt = nearestNode(g, toX, toY, originSide);
  if (nf.id === nt.id) return [];
  const { dist, prev } = dijkstra(g, nf.id, originSide);
  if (!Number.isFinite(dist[nt.id])) return [];
  const openCost = COST.open[classOf(stats)];
  const total = nf.d * openCost + dist[nt.id] + nt.d * openCost;
  const barrier = BARRIERS[profile];
  const straddles = barrier &&
    ((fromX < barrier.x0 && toX > barrier.x1) || (fromX > barrier.x1 && toX < barrier.x0));
  const directEstimate = direct * DIRECT_COST + (straddles ? barrier.penalty : 0);
  if (total >= directEstimate) return [];
  const chain = [];
  for (let at = nt.id; at !== -1; at = prev[at]) chain.push(g.nodes[at]);
  chain.reverse();
  const waypoints = chain.map(([x, y]) => [x, y]);
  const last = waypoints[waypoints.length - 1];
  if (!last || last[0] !== toX || last[1] !== toY) waypoints.push([toX, toY]);
  return waypoints;
}

// Stateless per-tick progression. Scanning from the END, the latest
// waypoint within reach is "where we are" — return the one after it
// (never an earlier one: first-unreached logic would BACKTRACK an asset
// standing mid-chain). Off the chain entirely (combat detour): resume at
// the nearest waypoint.
export function nextWaypoint(waypoints, atX, atY) {
  if (!waypoints.length) return null;
  for (let i = waypoints.length - 1; i >= 0; i--) {
    if (cheb(atX, atY, waypoints[i][0], waypoints[i][1]) <= WAYPOINT_DONE_CELLS) {
      return waypoints[Math.min(i + 1, waypoints.length - 1)];
    }
  }
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < waypoints.length; i++) {
    const d = cheb(atX, atY, waypoints[i][0], waypoints[i][1]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return waypoints[best];
}

// For the mirror test: the raw tables.
export function graphTables() {
  return GRAPHS;
}
