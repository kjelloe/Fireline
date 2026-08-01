// Why does the raider park 28 cells out? State dump every 200 ticks late-war.
import { GameServer } from "../engine/server.js";
const server = new GameServer({ mapSeed: 31337, enableAi: true, rules: { mode: 2, modeAttacker: 0 } });
const cell = (w) => w >> 8;
for (let t = 0; t < 9000; t++) {
  server.step();
  const s = server.state;
  if (s.tick >= 7200 && s.tick % 200 === 0) {
    const a = s.assets[19];
    console.log(`t=${s.tick} carrier#19 state=${a.state} pos=(${cell(a.x)},${cell(a.y)}) target=(${cell(a.targetX)},${cell(a.targetY)}) supp=${a.suppressedTimer} hp=${a.hp} fuel=${a.fuel} op=${a.operatorId}`);
  }
  if (s.phase === 1) break;
}
