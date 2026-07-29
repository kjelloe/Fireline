// test/pathfind.test.js — playtest-10 item 39: move orders steer AROUND
// walls. A* over cells, corners into the hashed waypoint queue, one
// mechanism for humans and AI. Mirror discipline: equal-f ties rank by
// mirror-invariant quantities (the route-graph law).

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { findCellPath, pathToWaypoints, segmentBlocked } from "../engine/pathfind.js";
import { getUnitStats } from "../engine/units.js";
import { T_OPEN, T_BLOCKING } from "../engine/mapgen.js";
import { cellToWorld, worldToCellFloor } from "../shared/fixedmath.js";
import { sandbox, joinAndSelect } from "./helpers.js";

// A 64x64 open map with a vertical wall at x=30, y 10..50 — a gap
// above (y<10) and below (y>50).
function walledMap() {
  const size = 64;
  const cells = new Uint8Array(size * size).fill(T_OPEN);
  for (let y = 10; y <= 50; y++) cells[y * size + 30] = T_BLOCKING;
  return { width: size, height: size, cells, seed: 1 };
}

const TANK = getUnitStats(0);

test("39: the ray sees the wall; A* goes around it, both endpoints kept", () => {
  const map = walledMap();
  assert.ok(segmentBlocked(map, cellToWorld(20), cellToWorld(30), cellToWorld(40), cellToWorld(30), TANK));
  const path = findCellPath(map, 20, 30, 40, 30, TANK);
  assert.ok(path, "a path exists around the wall");
  assert.deepEqual(path[0], [20, 30]);
  assert.deepEqual(path.at(-1), [40, 30]);
  for (const [x, y] of path) {
    assert.notEqual(map.cells[y * map.width + x], T_BLOCKING, `path avoids walls (${x},${y})`);
  }
});

test("39: waypoints are FEW corners, not a cell crawl, and each leg is clear", () => {
  const map = walledMap();
  const path = findCellPath(map, 20, 30, 40, 30, TANK);
  const legs = pathToWaypoints(map, path, TANK);
  assert.ok(legs.length >= 1 && legs.length <= 8, `legs: ${legs.length}`);
  let from = { x: cellToWorld(20), y: cellToWorld(30) };
  for (const leg of legs) {
    assert.ok(!segmentBlocked(map, from.x, from.y, leg.x, leg.y, TANK),
      "every pulled leg is a straight clear line");
    from = leg;
  }
  assert.deepEqual(legs.at(-1), { x: cellToWorld(40), y: cellToWorld(30) });
});

test("39: a plain move order across the wall fills the waypoint queue", () => {
  let s = sandbox([{ team: 0, cellX: 20, cellY: 30 }], [], { map: walledMap() });
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 40, targetCellY: 30 });
  const a = s.assets[0];
  assert.ok(a.waypoints.length >= 1, "corners queued");
  assert.notEqual(a.targetX, cellToWorld(40), "first leg is a corner, not the far side");
  const ordered = s.events.find((e) => e.type === "move_ordered");
  assert.equal(ordered.targetX, cellToWorld(40), "the event still names the ORDERED destination");
  // Walk it: the unit must actually ARRIVE without stalling.
  for (let i = 0; i < 3000 && s.assets[0].state === 1; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(worldToCellFloor(s.assets[0].x), 40, "arrived around the wall");
  assert.equal(worldToCellFloor(s.assets[0].y), 30);
});

test("39: an enclosed target keeps the old honest behaviour (no fake path)", () => {
  const map = walledMap();
  // Box in the target completely.
  for (let x = 38; x <= 42; x++) {
    map.cells[27 * map.width + x] = T_BLOCKING;
    map.cells[33 * map.width + x] = T_BLOCKING;
  }
  for (let y = 27; y <= 33; y++) {
    map.cells[y * map.width + 38] = T_BLOCKING;
    map.cells[y * map.width + 42] = T_BLOCKING;
  }
  assert.equal(findCellPath(map, 20, 30, 40, 30, TANK), null);
  let s = sandbox([{ team: 0, cellX: 20, cellY: 30 }], [], { map });
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 40, targetCellY: 30 });
  assert.equal(s.assets[0].waypoints.length, 0, "no path = no invented waypoints");
  assert.equal(s.assets[0].targetX, cellToWorld(40), "the ray stands; slide/stall handles it");
});

test("39: mirror equivariance — the detour reflects onto the mirrored detour", () => {
  // Wall with gaps both sides; a unit WEST of it mirrors to one EAST.
  const map = walledMap();
  const W = map.width;
  const stats = TANK;
  const path = findCellPath(map, 20, 30, 40, 30, stats);
  // Mirror the map (wall at x=30 -> x=63-30=33) and the endpoints.
  const mcells = new Uint8Array(W * W).fill(T_OPEN);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      mcells[y * W + (W - 1 - x)] = map.cells[y * W + x];
    }
  }
  const mmap = { width: W, height: W, cells: mcells, seed: 1 };
  const mpath = findCellPath(mmap, W - 1 - 20, 30, W - 1 - 40, 30, stats);
  assert.equal(mpath.length, path.length, "same length detour");
  for (let i = 0; i < path.length; i++) {
    assert.deepEqual(mpath[i], [W - 1 - path[i][0], path[i][1]],
      `step ${i} is the exact reflection`);
  }
});
