// test/route_graph.test.js — 13C: the route graph. Mirror-closed tables,
// deterministic shortest paths, class-aware costs (heavies shun trails),
// bridge routing over fording, and the direct-skip contract.

import { test } from "node:test";
import assert from "node:assert/strict";
import { routeWaypoints, nextWaypoint, graphTables } from "../engine/route_graph.js";
import { getUnitStats, UNIT_TANK, UNIT_SCOUT, UNIT_SKIMMER } from "../engine/units.js";

const TANK = getUnitStats(UNIT_TANK);
const SCOUT = getUnitStats(UNIT_SCOUT);

test("tables keep the mirror invariant: every node and edge has its x-mirror", () => {
  for (const [profile, g] of Object.entries(graphTables())) {
    const key = (x, y) => `${x},${y}`;
    const nodes = new Set(g.n.map(([x, y]) => key(x, y)));
    for (const [x, y] of g.n) {
      assert.ok(nodes.has(key(127 - x, y)), `${profile}: node ${x},${y} lacks mirror`);
    }
    const mirrorId = g.n.map(([x, y]) => g.n.findIndex(([mx, my]) => mx === 127 - x && my === y));
    const edges = new Set(g.e.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
    for (const [a, b, tag] of g.e) {
      const ma = mirrorId[a];
      const mb = mirrorId[b];
      assert.ok(edges.has(`${Math.min(ma, mb)}-${Math.max(ma, mb)}`),
        `${profile}: edge ${a}-${b} (${tag}) lacks mirrored edge ${ma}-${mb}`);
    }
  }
});

test("deterministic: identical inputs, identical waypoints", () => {
  const a = routeWaypoints("frontier_corridor", 10, 60, 95, 63, TANK);
  const b = routeWaypoints("frontier_corridor", 10, 60, 95, 63, TANK);
  assert.deepEqual(a, b);
  assert.ok(a.length >= 2, "a cross-map trip routes through the graph");
});

test("short hops and unknown profiles go direct", () => {
  assert.deepEqual(routeWaypoints("frontier_corridor", 30, 63, 40, 63, TANK), []);
  assert.deepEqual(routeWaypoints("no_such_map", 5, 5, 120, 120, TANK), []);
});

test("the Skimmer never routes — water is its road", () => {
  const skimmer = getUnitStats(UNIT_SKIMMER);
  assert.deepEqual(routeWaypoints("riverline", 10, 60, 110, 60, skimmer), []);
});

test("riverline: a heavy crossing the river is routed over a BRIDGE, never a ford", () => {
  // Team A tank at its base going for the far east relay (83,32).
  const wps = routeWaypoints("riverline", 10, 60, 83, 32, TANK);
  assert.ok(wps.length >= 3, `expected a routed chain, got ${JSON.stringify(wps)}`);
  const usesBridge = wps.some(([x, y]) =>
    (x === 58 || x === 69) && y === 63 || (x === 59 || x === 68) && (y === 21 || y === 105));
  assert.ok(usesBridge, `route must cross at a bridge: ${JSON.stringify(wps)}`);
  // No waypoint strands mid-water (cols 60-67 off the bridge rows).
  for (const [x, y] of wps) {
    const onBridgeRow = (y >= 62 && y <= 65) || (y >= 20 && y <= 23) || (y >= 104 && y <= 107);
    assert.ok(!(x >= 60 && x <= 67 && !onBridgeRow), `waypoint ${x},${y} is in the river`);
  }
});

test("class-aware: a trail-native trip keeps the scout on trails, sends the tank to the road", () => {
  // West trail end to east trail end. The scout (trail 8/cell) rides the
  // trail chain; the tank (trail 20/cell) detours down to the road.
  const scoutRoute = routeWaypoints("frontier_corridor", 24, 40, 103, 40, SCOUT);
  const tankRoute = routeWaypoints("frontier_corridor", 24, 40, 103, 40, TANK);
  const trailNodes = (wps) => wps.filter(([x, y]) => y === 40 && x > 24 && x < 103).length;
  const roadNodes = (wps) => wps.filter(([, y]) => y === 63).length;
  assert.ok(trailNodes(scoutRoute) >= 1, `scout rides the trail: ${JSON.stringify(scoutRoute)}`);
  assert.equal(roadNodes(scoutRoute), 0, "scout has no reason to drop to the road");
  assert.ok(roadNodes(tankRoute) >= 1, `tank drops to the road: ${JSON.stringify(tankRoute)}`);
});

test("nextWaypoint: stateless progression skips reached waypoints", () => {
  const wps = [[30, 63], [58, 63], [95, 63]];
  assert.deepEqual(nextWaypoint(wps, 29, 63), [58, 63], "within 2 cells counts as reached");
  assert.deepEqual(nextWaypoint(wps, 58, 62), [95, 63]);
  assert.deepEqual(nextWaypoint(wps, 95, 63), [95, 63], "final waypoint sticks");
  assert.equal(nextWaypoint([], 5, 5), null);
});

test("13D: a marked minefield on the road pushes the route onto the trails", () => {
  const clean = routeWaypoints("frontier_corridor", 10, 60, 95, 63, TANK);
  assert.ok(clean.some(([x, y]) => y === 63 && x >= 32 && x <= 69), "clean run rides the road");
  // Mines marked across the road at the west relay's doorstep.
  const hazards = [[40, 63], [41, 63], [40, 62]];
  const wary = routeWaypoints("frontier_corridor", 10, 60, 95, 63, TANK, hazards);
  const roadHop = wary.some(([x, y]) => y === 63 && x >= 33 && x <= 45);
  assert.ok(!roadHop, `detours the mined stretch: ${JSON.stringify(wary)}`);
});

test("13D: far mines change nothing; hazard overlay is query-local", () => {
  const clean = routeWaypoints("frontier_corridor", 10, 60, 95, 63, TANK);
  const far = routeWaypoints("frontier_corridor", 10, 60, 95, 63, TANK, [[5, 5]]);
  assert.deepEqual(far, clean, "irrelevant hazards leave the route alone");
  const cleanAgain = routeWaypoints("frontier_corridor", 10, 60, 95, 63, TANK);
  assert.deepEqual(cleanAgain, clean, "no overlay leakage into the cached graph");
});
