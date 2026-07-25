// test/headless/sim1b.js
// Deterministic five-second equivalent server-loop run (50 ticks at 10 Hz).
// Run: node test/headless/sim1b.js

import { GameServer } from "../../engine/server.js";

const server = new GameServer({ mapSeed: 42, mapProfile: "frontier_corridor", snapshotCapacity: 30 });
console.log("=== Milestone 1B Headless Server Simulation ===");
console.log("Mode: deterministic 50-step run (equivalent to 5.0 seconds at 10 Hz)\n");

for (const command of [
  { type: "join_operator", operatorId: 0, team: 0 },
  { type: "join_operator", operatorId: 1, team: 1 },
  { type: "select_asset", operatorId: 0, assetId: 0 },
  { type: "select_asset", operatorId: 1, assetId: 4 },
  { type: "move_order", operatorId: 0, targetCellX: 63, targetCellY: 63 },
  { type: "move_order", operatorId: 1, targetCellX: 64, targetCellY: 63 },
]) server.enqueue(command);

for (let i = 0; i < 50; i++) {
  const snapshot = server.step();
  if (snapshot.tick === 1 || snapshot.tick % 10 === 0 || snapshot.views[0].events.length) {
    const a0 = server.state.assets[0], a4 = server.state.assets[4];
    console.log(
      `Tick ${String(snapshot.tick).padStart(2)} | ${snapshot.stateHash} | ` +
      `A0 ${ (a0.x / 256).toFixed(2)},${(a0.y / 256).toFixed(2) } | ` +
      `A4 ${ (a4.x / 256).toFixed(2)},${(a4.y / 256).toFixed(2) } | ` +
      `ring ${server.snapshots.length}/30` +
      (snapshot.views[0].events.length ? ` | events: ${snapshot.views[0].events.map(e => e.type).join(", ")}` : "")
    );
  }
}
console.log(`\nFinal tick: ${server.state.tick}`);
console.log(`Snapshots retained: ${server.snapshots.length}`);
console.log(`Final authoritative state hash: ${server.getLatestSnapshot().stateHash}`);
