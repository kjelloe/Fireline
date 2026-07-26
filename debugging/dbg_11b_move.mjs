import { apply } from "../engine/reducer.js";
import { sandbox, joinSelectMove } from "../test/helpers.js";

let s = sandbox(
  [{ team: 0, cellX: 3 }, { team: 1, cellX: 6 }],
  [{ cellX: 3, owner: -1 }]
);
for (let i = 0; i < 30 && s.sites[0].owner !== 0; i++) s = apply(s, { type: "advance_tick" });
s = joinSelectMove(s, 1, 1, 1, 3, 0);
for (let i = 0; i < 400 && s.sites[0].owner !== 1; i++) s = apply(s, { type: "advance_tick" });

s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
console.log("join:", s.events);
s = apply(s, { type: "select_asset", operatorId: 0, assetId: 0, confirm: true });
console.log("select:", s.events);
s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 20, targetCellY: 20 });
console.log("move:", s.events, "asset0:", s.assets[0].state, s.assets[0].targetX, s.assets[0].fuel);
s = apply(s, { type: "advance_tick" });
console.log("tick: asset0 pos", s.assets[0].x, s.assets[0].y, "heading", s.assets[0].heading, "state", s.assets[0].state);
