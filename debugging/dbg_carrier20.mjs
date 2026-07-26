import { GameServer } from "../engine/server.js";
import { inSupply } from "../engine/supply.js";
const server = new GameServer({ mapSeed: 777, enableAi: true, aiDifficulty: 1 });
for (let i = 0; i < 12000 && server.state.phase === 0; i++) server.step();
const s = server.state;
const c = s.assets[20];
console.log("carrier20:", { x: (c.x/256)|0, y: (c.y/256)|0, state: c.state, hp: c.hp,
  fuel: c.fuel, ammo: c.ammo, op: c.operatorId, supplied: inSupply(s, c),
  target: [(c.targetX/256)|0, (c.targetY/256)|0] });
console.log("std0 home:", s.standards[0].homeCellX, s.standards[0].homeCellY);
console.log("std1:", { status: s.standards[1].status, home: [s.standards[1].homeCellX, s.standards[1].homeCellY] });
console.log("sites:", s.sites.map(x => x.owner));
