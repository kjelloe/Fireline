// debugging/dbg_unique_mechanism.mjs — WHAT does each unique actually
// do all war? (sawtooth 69% A hunt; crewing ON by default since the
// 16B fix.) Per-unique activity profile: crewed / deployed / anchor
// (within capture radius of a relay) / sole-contest ticks, kills,
// deaths, recoveries — sawtooth vs frontier as control.
//   node debugging/dbg_unique_mechanism.mjs            # sawtooth
//   MAP=frontier_corridor node debugging/dbg_unique_mechanism.mjs
import { GameServer } from "../engine/server.js";
import { worldToCellFloor } from "../shared/fixedmath.js";

const MAPPROF = process.env.MAP || "sawtooth";
const SEEDS = [2026, 777, 31337, 4242, 9001];

const prof = { 7: mk(), 8: mk() };
function mk() {
  return { crewed: 0, deployed: 0, anchor: 0, soleContest: 0, kills: 0, deaths: 0, restored: 0 };
}

for (const seed of SEEDS) {
  const war = new GameServer({ mapSeed: seed, enableAi: true, aiDifficulty: 1, mapProfile: MAPPROF });
  const uid = new Map(war.state.assets.filter((a) => a.type === 7 || a.type === 8).map((a) => [a.id, a.type]));
  for (let i = 0; i < 16000 && war.state.phase === 0; i++) {
    war.step();
    const s = war.state;
    for (const e of s.events) {
      if (e.type === "asset_disabled") {
        if (uid.has(e.assetId)) prof[uid.get(e.assetId)].deaths++;
        if (e.by === "asset" && (e.byType === 7 || e.byType === 8)) prof[e.byType].kills++;
      }
      if (e.type === "asset_restored" && uid.has(e.assetId)) prof[uid.get(e.assetId)].restored++;
    }
    if (i % 5 !== 0) continue; // sample cadence
    for (const [id, type] of uid) {
      const a = s.assets[id];
      if (!a || a.state === 2 || a.state === 3 || a.operatorId === -1) continue;
      const p = prof[type];
      p.crewed++;
      if (a.deployed === 1) p.deployed++;
      const cx = worldToCellFloor(a.x);
      const cy = worldToCellFloor(a.y);
      for (const site of s.sites) {
        const d = Math.max(Math.abs(site.cellX - cx), Math.abs(site.cellY - cy));
        if (d <= 1) {
          p.anchor++;
          // Sole friendly presence on ground the enemy is trying to take?
          if (site.capturingTeam !== -1 && site.capturingTeam !== a.team) p.soleContest++;
          break;
        }
      }
    }
  }
}
console.log(`${MAPPROF} (5 wars, samples every 5 ticks):`);
for (const [type, name] of [[7, "Sentinel (A)"], [8, "Skimmer  (B)"]]) {
  const p = prof[type];
  console.log(`  ${name}: crewed=${p.crewed} deployed=${p.deployed} anchor=${p.anchor} ` +
    `contestHold=${p.soleContest} kills=${p.kills} deaths=${p.deaths} restored=${p.restored}`);
}
