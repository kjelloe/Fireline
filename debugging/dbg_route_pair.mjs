import { routeWaypoints, graphTables } from "../engine/route_graph.js";
import { getUnitStats } from "../engine/units.js";
const TANK = getUnitStats(0);
console.log("west :", JSON.stringify(routeWaypoints("frontier_corridor", 28, 8, 32, 63, TANK)));
console.log("east :", JSON.stringify(routeWaypoints("frontier_corridor", 99, 8, 95, 63, TANK)));
// brute internals
const g = graphTables().frontier_corridor;
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
for (const [label, x, y] of [["west-from", 28, 8], ["east-from", 99, 8]]) {
  const ds = g.n.map(([nx, ny], i) => [i, cheb(x, y, nx, ny)]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  console.log(label, "nearest:", JSON.stringify(ds.slice(0, 3)));
}
