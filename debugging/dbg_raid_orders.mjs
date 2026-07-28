// What orders does the raider carrier actually get?
import { GameServer } from "../engine/server.js";
const server = new GameServer({ mapSeed: 9001, enableAi: true });
const C = 256;
for (let t = 0; t < 900; t++) {
  server.step();
  const s = server.state;
  for (const { tick, cmd } of server.commandLog.slice(-30)) {
    if (tick !== s.tick - 1) continue;
    if (cmd.operatorId === 24 && cmd.type === "move_order") {
      const a = s.assets[8];
      console.log(`t=${tick} carrier8 at (${a.x / C | 0},${a.y / C | 0}) ordered to (${cmd.targetCellX},${cmd.targetCellY})`);
    }
  }
}
const std = server.state.standards[1];
console.log("enemy std home:", std.homeCellX, std.homeCellY, "status", std.status);
