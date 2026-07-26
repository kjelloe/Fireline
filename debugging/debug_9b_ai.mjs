import { GameServer } from "../engine/server.js";
const server = new GameServer({ mapSeed: 42, enableAi: true });
server.step();
const S = () => server.state;
S().bases.push({ team: 1, x: 0, y: 40, width: 24, height: 24 });
S().assets[4].x = S().assets[0].x + 512;
S().assets[4].y = S().assets[0].y;
S().assets[0].hp = 20;
for (let i = 0; i < 40; i++) {
  server.step();
  if (S().operators[16].state === 2) { console.log("downed at step", i); break; }
}
console.log("op16 state:", S().operators[16].state, "asset0 hp:", S().assets[0].hp,
  "asset0 state:", S().assets[0].state, "asset4 hp:", S().assets[4].hp,
  "asset4 state:", S().assets[4].state, "downed:", S().downed.map(d => d.operatorId));
