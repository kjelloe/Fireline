// test/headless/sim1g.js — 1G headless combat demo: two tanks duel until disablement.

import { apply, createInitialState } from "../../engine/reducer.js";
import { ASSET_DISABLED } from "../../engine/state.js";
import { T_OPEN } from "../../engine/mapgen.js";
import { cellToWorld } from "../../shared/fixedmath.js";

const size = 32;
const map = { width: size, height: size, cells: new Uint8Array(size * size).fill(T_OPEN), seed: 7 };
let s = createInitialState(7, map);
s.assets = [0, 1].map((id) => ({
  id, type: 0, team: id, state: 0,
  x: cellToWorld(id === 0 ? 10 : 12), y: cellToWorld(10),
  targetX: cellToWorld(id === 0 ? 10 : 12), targetY: cellToWorld(10),
  hp: id === 0 ? 100 : 60, operatorId: -1, moveProgress: 0,
}));

s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
s = apply(s, { type: "select_asset", operatorId: 0, assetId: 0 });

let tick = 0;
while (s.assets[1].state !== ASSET_DISABLED) {
  const before = s.assets[1].hp;
  if (s.assets[0].reloadTimer === 0) {
    s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
    const a = s.assets[1];
    const status = a.state === ASSET_DISABLED ? "DISABLED" : "ACTIVE";
    console.log(`Tick ${s.tick} | A0 fires at A1 | A1 hp: ${before} -> ${a.hp} | status: ${status}`);
  }
  s = apply(s, { type: "advance_tick" });
  tick = s.tick;
}
console.log(`A1 disabled after ${tick} ticks.`);
