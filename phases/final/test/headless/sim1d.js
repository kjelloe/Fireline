// test/headless/sim1d.js
// Run: node test/headless/sim1d.js

import { GameServer } from "../../engine/server.js";

const server = new GameServer({ mapSeed: 42, mapProfile: "frontier_corridor", enableAi: true });
console.log("=== Milestone 1D AI Regency Simulation ===");
console.log("Eight deterministic regents populate the initial field assets.\n");

for (let i = 0; i < 100; i++) {
  const snapshot = server.step();
  if (snapshot.tick === 1 || snapshot.tick === 2 || snapshot.tick % 10 === 0) {
    const a0 = server.state.assets[0];
    const a4 = server.state.assets[4];
    const operated = server.state.assets.filter(a => a.operatorId !== -1).length;
    console.log(`Tick ${String(snapshot.tick).padStart(3)} | hash ${snapshot.stateHash} | operated ${operated}/8 | A0 ${(a0.x/256).toFixed(1)},${(a0.y/256).toFixed(1)} | B0 ${(a4.x/256).toFixed(1)},${(a4.y/256).toFixed(1)}`);
  }
}
console.log(`\nFinal hash: ${server.getLatestSnapshot().stateHash}`);
