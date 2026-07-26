// engine/drone.js — Slice 9G: the anti-camping drone (slim model, ruling Q7).
// Camping = idling OUTSIDE your own supply umbrella. Do it long enough and
// the enemy's nearest owned relay launches a drone at you: fast, straight
// flight over any terrain, light repeated damage on station. Any direct-fire
// unit downs it with one hit; it recalls the moment its target moves (or
// gets back in supply), so the counterplay is simply to stop camping.
// First flying entity: exempt from terrain speed/blocking and from fog —
// drones are loud and public to both teams.

export const CAMP_TICKS = 300;            // 30 s of unsupplied idling draws one
export const DRONE_SPEED = 72;            // outruns every chassis (scout is 56)
export const DRONE_LIFETIME = 600;        // 60 s endurance, then it expires
export const DRONE_HIT_INTERVAL = 10;     // pesters once a second on station
export const DRONE_DAMAGE = 4;            // light — pressure, not an executioner
export const DRONE_STATION_CELLS = 1;     // must be overhead/adjacent to sting

// A unit is camping when it sits idle outside its own supply umbrella.
// (state check is the caller's: ASSET_IDLE + !inSupply.)

// Nearest enemy-owned relay to the camper launches; ties break on lowest
// site id for determinism. Returns null when the enemy owns no relay.
export function launchSiteFor(state, camper, chebyshevCells) {
  const enemy = camper.team === 0 ? 1 : 0;
  let best = null;
  let bestDist = -1;
  for (const site of state.sites) {
    if (site.owner !== enemy) continue;
    const d = chebyshevCells(camper, {
      x: site.cellX * 256, y: site.cellY * 256,
    });
    if (best === null || d < bestDist) {
      best = site;
      bestDist = d;
    }
  }
  return best;
}

// Straight-line integer chase: step each axis toward the target, clamped to
// DRONE_SPEED. Diagonal-biased Chebyshev flight — deterministic and terrain-
// blind, which is exactly what a flying pest wants.
export function stepDrone(drone, targetX, targetY) {
  const dx = targetX - drone.x;
  const dy = targetY - drone.y;
  drone.x += dx > DRONE_SPEED ? DRONE_SPEED : dx < -DRONE_SPEED ? -DRONE_SPEED : dx;
  drone.y += dy > DRONE_SPEED ? DRONE_SPEED : dy < -DRONE_SPEED ? -DRONE_SPEED : dy;
}
