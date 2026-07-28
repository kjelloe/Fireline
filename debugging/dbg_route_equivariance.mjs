// dbg_route_equivariance.mjs — is routeWaypoints itself mirror-fair?
// For a grid of trips: route(mirror(from) -> mirror(to)) must equal
// mirror(route(from -> to)). Violations print the trip and both routes.
import { routeWaypoints } from "../engine/route_graph.js";
import { getUnitStats } from "../engine/units.js";

const M = (x) => 127 - x;
const TANK = getUnitStats(0);
const SCOUT = getUnitStats(1);
let checked = 0, bad = 0;
for (const profile of ["frontier_corridor", "riverline"]) {
  for (const stats of [TANK, SCOUT]) {
    for (let fx = 4; fx < 124; fx += 8) {
      for (let fy = 8; fy < 120; fy += 12) {
        for (const [tx, ty] of [[32, 63], [95, 63], [58, 63], [69, 63], [44, 32], [83, 95], [14, 59], [113, 59]]) {
          const a = routeWaypoints(profile, fx, fy, tx, ty, stats);
          const b = routeWaypoints(profile, M(fx), fy, M(tx), ty, stats);
          const am = a.map(([x, y]) => [M(x), y]);
          checked++;
          if (JSON.stringify(am) !== JSON.stringify(b)) {
            bad++;
            if (bad <= 5) {
              console.log(`${profile} ${stats === TANK ? "tank" : "scout"} (${fx},${fy})->(${tx},${ty})`);
              console.log("  route      :", JSON.stringify(a));
              console.log("  mirror got :", JSON.stringify(b));
              console.log("  expected   :", JSON.stringify(am));
            }
          }
        }
      }
    }
  }
}
console.log(`checked ${checked}, violations ${bad}`);
