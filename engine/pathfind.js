// engine/pathfind.js — grid A* around WALLS (playtest-10 item 39).
//
// Before this, a move order was a straight ray: a unit facing a mesa
// ran INTO it and slid along the face (18E), or stalled head-on. Now a
// plain move order whose ray crosses impassable ground gets a real
// path: A* over cells, corners simplified, stuffed into the existing
// (hashed) waypoint queue — one mechanism for humans and AI alike.
//
// Determinism + mirror rules:
// - Integer costs only (256 straight, 362 diagonal; octile heuristic).
// - Diagonals never cut corners (both orthogonal neighbours must be
//   open — matches the slide rule's honesty about walls).
// - TIE-BREAKS COMMUTE WITH THE MIRROR (specs/08; the route-graph
//   lesson): equal-f candidates rank by |2x-(W-1)| then |2y-(H-1)| —
//   both invariant under reflection — then by y (untouched by the
//   x-mirror), then by x in TRIP-ORIGIN-SIDE order (west origins
//   prefer west, east origins prefer east — the route graph's
//   origin-side law). The old raw-index tail claimed it "only fires
//   on the axis"; it actually fired for EVERY equal-cost mirror-
//   partner detour (any wall gives you one) and was the engine's
//   directional residue — the divergence probe went red the moment a
//   map had walls. Parent selection re-parents on equal g under the
//   same order, so expansion order can never leak into path shape.
// - Terrain is obstacle-blind beyond walls: A* avoids 0-speed cells
//   only. Slow ground is the route graph's business (13C/13D), not
//   this last-mile planner's.

import { speedMultiplier } from "./terrain.js";
import { worldToCellFloor, cellToWorld, absI32, sampleCellX } from "../shared/fixedmath.js";

export const PATHFIND_MAX_EXPAND = 4096; // enclosed target = give up, old behaviour

function walled(map, cx, cy, stats) {
  if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) return true;
  return speedMultiplier(map.cells[cy * map.width + cx], stats) === 0;
}

// Does the straight world-space segment cross a walled cell? Sampled
// at half-cell steps — the same granularity movement itself uses.
export function segmentBlocked(map, x0, y0, x1, y1, stats) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.max(absI32(dx), absI32(dy)) >> 7); // /128
  for (let i = 1; i <= steps; i++) {
    const x = x0 + ((dx * i / steps) | 0);
    const y = y0 + ((dy * i / steps) | 0);
    if (walled(map, sampleCellX(x, map.width), worldToCellFloor(y), stats)) return true;
  }
  return false;
}

// Mirror-invariant rank for equal-f ties (route_graph rankBetter's law).
function tieRank(map, idx) {
  const x = idx % map.width;
  const y = (idx / map.width) | 0;
  return [absI32(2 * x - (map.width - 1)), absI32(2 * y - (map.height - 1))];
}

// A* from one cell to another. Returns the cell path INCLUDING both
// endpoints, or null (no path / expansion cap). 8-connected, no
// corner cutting.
export function findCellPath(map, fromX, fromY, toX, toY, stats, maxExpand = PATHFIND_MAX_EXPAND) {
  if (walled(map, toX, toY, stats) || walled(map, fromX, fromY, stats)) return null;
  const W = map.width;
  const start = fromY * W + fromX;
  const goal = toY * W + toX;
  if (start === goal) return [[fromX, fromY]];

  const g = new Map([[start, 0]]);
  const came = new Map();
  const closed = new Set();
  const h = (idx) => {
    const dx = absI32((idx % W) - toX);
    const dy = absI32(((idx / W) | 0) - toY);
    return dx > dy ? 256 * (dx - dy) + 362 * dy : 256 * (dy - dx) + 362 * dx;
  };
  // Sorted-array frontier: pop the best by (f, mirror-rank, y,
  // origin-side x). n is small; clarity beats a heap here.
  const flip = 2 * fromX > W - 1; // trip-origin side: east origins mirror the x-order
  const nodeBetter = (ia, ib) => {
    const ra = tieRank(map, ia);
    const rb = tieRank(map, ib);
    if (ra[0] !== rb[0]) return ra[0] > rb[0];
    if (ra[1] !== rb[1]) return ra[1] > rb[1];
    const ya = (ia / W) | 0;
    const yb = (ib / W) | 0;
    if (ya !== yb) return ya < yb;
    const xa = ia % W;
    const xb = ib % W;
    return flip ? xa > xb : xa < xb;
  };
  const open = [[h(start), start]];
  const better = (a, b) => {
    if (a[0] !== b[0]) return a[0] < b[0];
    return nodeBetter(a[1], b[1]);
  };
  let expanded = 0;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (better(open[i], open[bi])) bi = i;
    const [, cur] = open.splice(bi, 1)[0];
    if (closed.has(cur)) continue;
    if (cur === goal) {
      const path = [];
      for (let n = goal; n !== undefined; n = came.get(n)) path.push([n % W, (n / W) | 0]);
      return path.reverse();
    }
    closed.add(cur);
    if (++expanded > maxExpand) return null;
    const cx = cur % W;
    const cy = (cur / W) | 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (ox === 0 && oy === 0) continue;
        const nx = cx + ox;
        const ny = cy + oy;
        if (walled(map, nx, ny, stats)) continue;
        if (ox !== 0 && oy !== 0 &&
            (walled(map, cx + ox, cy, stats) || walled(map, cx, cy + oy, stats))) {
          continue; // no corner cutting
        }
        const nIdx = ny * W + nx;
        if (closed.has(nIdx)) continue;
        const cost = (g.get(cur) ?? 0) + (ox !== 0 && oy !== 0 ? 362 : 256);
        const prev = g.get(nIdx) ?? Infinity;
        if (cost < prev) {
          g.set(nIdx, cost);
          came.set(nIdx, cur);
          open.push([cost + h(nIdx), nIdx]);
        } else if (cost === prev && nodeBetter(cur, came.get(nIdx))) {
          // Equal-cost parent: keep the CANONICAL one (mirror-
          // equivariant order), so neighbor-iteration order can never
          // decide the path's shape.
          came.set(nIdx, cur);
        }
      }
    }
  }
  return null;
}

// Corner extraction + string pulling: keep only the cells where the
// direction changes, then drop corners whose neighbours see each other
// in a straight unblocked line. Returns WORLD waypoints (cell centres),
// excluding the start, ending at the final cell.
export function pathToWaypoints(map, path, stats, maxLegs = 8) {
  if (!path || path.length < 2) return [];
  const corners = [];
  for (let i = 1; i < path.length - 1; i++) {
    const [ax, ay] = path[i - 1];
    const [bx, by] = path[i];
    const [cx, cy] = path[i + 1];
    if ((bx - ax) !== (cx - bx) || (by - ay) !== (cy - by)) corners.push(path[i]);
  }
  corners.push(path[path.length - 1]);
  // String pulling: skip ahead as far as the straight line stays open.
  const pulled = [];
  let anchor = path[0];
  let i = 0;
  while (i < corners.length) {
    let j = corners.length - 1;
    for (; j > i; j--) {
      if (!segmentBlocked(map,
        cellToWorld(anchor[0]), cellToWorld(anchor[1]),
        cellToWorld(corners[j][0]), cellToWorld(corners[j][1]), stats)) break;
    }
    pulled.push(corners[j]);
    anchor = corners[j];
    i = j + 1;
  }
  return pulled.slice(0, maxLegs).map(([x, y]) => ({ x: cellToWorld(x), y: cellToWorld(y) }));
}
