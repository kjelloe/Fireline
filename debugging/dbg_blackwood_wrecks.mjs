// debugging/dbg_blackwood_wrecks.mjs — WHERE do blackwood wrecks die,
// and how far is that from terrain a tow truck moves well on?
// Instrument-first (specs/08 §3.8) before drawing recovery corridors.
//
//   node debugging/dbg_blackwood_wrecks.mjs

import { GameServer } from "../engine/server.js";
import { T_ROAD, T_PATH, T_OPEN } from "../engine/mapgen.js";
import { worldToCellFloor as worldToCell } from "../shared/fixedmath.js";

const SEEDS = [2026, 777, 31337, 4242, 9001];
const TICKS = 16000;

function nearestFastDist(map, cx, cy) {
  // Chebyshev distance to the nearest road/trail cell (truck-fast ground).
  let best = 999;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = map.cells[y * map.width + x];
      if (t === T_ROAD || t === T_PATH) {
        const d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
        if (d < best) best = d;
      }
    }
  }
  return best;
}

const distAll = [];
let disables = 0, towStarts = 0, restores = 0;
const heat = new Map(); // "x,y" cell -> wreck count (10x10 buckets)

for (const seed of SEEDS) {
  const war = new GameServer({ mapSeed: seed, enableAi: true, aiDifficulty: 1, mapProfile: process.env.MAP || "blackwood" });
  const map = war.state.map;
  for (let i = 0; i < TICKS && war.state.phase === 0; i++) {
    war.step();
    for (const e of war.state.events) {
      if (e.type === "asset_disabled") {
        disables++;
        const a = war.state.assets.find((x) => x.id === e.assetId);
        if (!a) continue;
        const cx = worldToCell(a.x), cy = worldToCell(a.y);
        distAll.push(nearestFastDist(map, cx, cy));
        const key = `${(cx / 13) | 0},${(cy / 13) | 0}`;
        heat.set(key, (heat.get(key) ?? 0) + 1);
      }
      if (e.type === "tow_started") towStarts++;
      if (e.type === "asset_restored") restores++;
    }
  }
}

distAll.sort((a, b) => a - b);
const q = (p) => distAll[Math.min(distAll.length - 1, (distAll.length * p) | 0)];
console.log(`5 seeds x ${TICKS} ticks on ${process.env.MAP || "blackwood"}`);
console.log(`disables=${disables} towStarts=${towStarts} restores=${restores}`);
console.log(`wreck distance to nearest road/trail cell (Chebyshev):`);
console.log(`  min=${distAll[0]} q25=${q(0.25)} median=${q(0.5)} q75=${q(0.75)} max=${distAll[distAll.length - 1]}`);
const far = distAll.filter((d) => d > 6).length;
console.log(`  wrecks >6 cells off fast ground: ${far}/${distAll.length} (${Math.round((100 * far) / distAll.length)}%)`);
console.log(`wreck heat (10x10 zones with >=5 wrecks, zone = cell/13):`);
[...heat.entries()].filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1])
  .forEach(([k, n]) => console.log(`  zone(${k}) x13 => ~cells ${k.split(",").map((v) => v * 13).join(",")}: ${n}`));
