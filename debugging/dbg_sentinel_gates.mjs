// debugging/dbg_sentinel_gates.mjs — is the A lean the SENTINEL x CHOKES
// meta? Uses the B7 killer identity on disable events: count kills by
// chassis, and how many Sentinel kills happen near a gate (base
// perimeter) or a mesa gap. Also where Sentinels deploy.
import { GameServer } from "../engine/server.js";
import { worldToCellFloor } from "../shared/fixedmath.js";

const MAPPROF = process.env.MAP || "frontier_corridor";
const GATES = [ // frontier/sawtooth share base rects; front+side gate centres
  [23, 62], [13, 54], [13, 73], [104, 62], [111, 54], [111, 73],
];
const GAPS = MAPPROF === "sawtooth" ? [[42, 46], [85, 46], [42, 82], [85, 82]] : [];
const nearChoke = (cx, cy) =>
  [...GATES, ...GAPS].some(([gx, gy]) => Math.max(Math.abs(cx - gx), Math.abs(cy - gy)) <= 5);

const killsByType = new Map();
let sentinelKills = 0, sentinelChokeKills = 0, deploys = 0, chokeDeploys = 0;
const teamKills = [0, 0];

for (const seed of [2026, 777, 31337, 4242, 9001]) {
  const war = new GameServer({ mapSeed: seed, enableAi: true, aiDifficulty: 1, mapProfile: MAPPROF });
  for (let i = 0; i < 16000 && war.state.phase === 0; i++) {
    war.step();
    for (const e of war.state.events) {
      if (e.type === "asset_disabled" && e.by === "asset") {
        killsByType.set(e.byType, (killsByType.get(e.byType) ?? 0) + 1);
        const victim = war.state.assets[e.assetId];
        if (victim) teamKills[victim.team === 0 ? 1 : 0] += 1;
        if (e.byType === 7) {
          sentinelKills++;
          if (victim && nearChoke(worldToCellFloor(victim.x), worldToCellFloor(victim.y))) {
            sentinelChokeKills++;
          }
        }
      }
      if (e.type === "hardpoint_deployed" || e.type === "asset_deployed") {
        deploys++;
        const a = war.state.assets[e.assetId];
        if (a && nearChoke(worldToCellFloor(a.x), worldToCellFloor(a.y))) chokeDeploys++;
      }
    }
  }
}
console.log(`${MAPPROF}: gun kills by chassis:`,
  [...killsByType.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `type${t}=${n}`).join(" "));
console.log(`sentinel kills: ${sentinelKills}, near a gate/gap: ${sentinelChokeKills}`);
console.log(`deploys: ${deploys}, near a choke: ${chokeDeploys}`);
console.log(`kills credited to team A guns: ${teamKills[0]}, team B guns: ${teamKills[1]}`);
