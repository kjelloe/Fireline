// dbg_16b_sentinel.mjs — does the Sentinel (asset 18) ever get crewed /
// deploy in an AI war? Trace its operator, position, and hardpoint events.
import { GameServer } from "../engine/server.js";
const seed = Number(process.env.SEED ?? 2026);
const server = new GameServer({ mapSeed: seed, enableAi: true });
let lastOp = -2;
for (let t = 0; t < 12000; t++) {
  server.step();
  const s = server.state;
  const sen = s.assets[18];
  for (const e of s.events) {
    if (String(e.type).startsWith("hardpoint")) console.log(t, JSON.stringify(e));
  }
  if (sen.operatorId !== lastOp) {
    console.log(`t=${t} sentinel18 operator ${lastOp} -> ${sen.operatorId} hp=${sen.hp} cell=(${Math.floor(sen.x / 256)},${Math.floor(sen.y / 256)})`);
    lastOp = sen.operatorId;
  }
  if (s.phase === 2) { console.log("game over at", t); break; }
}
const sen = server.state.assets[18];
console.log("final: op", sen.operatorId, "hp", sen.hp, "deployed", sen.deployed);
