// test/headless/sim1a.js
// Headless 1A simulation: 60-tick soak with two operators and movement.
// Run: node test/headless/sim1a.js

import { createInitialState } from "../../engine/state.js";
import { apply } from "../../engine/reducer.js";
import { buildView } from "../../engine/view.js";
import { computeFnv1a64, hashToHex64, createByteWriter } from "../../shared/canonical.js";

function stateHash(s) {
  const w = createByteWriter();
  w.writeU32LE(s.tick); w.writeU32LE(s.mapSeed);
  for (const sc of s.teamScores) w.writeI32LE(sc);
  for (const o of s.operators) {
    w.writeI32LE(o.id); w.writeI32LE(o.team); w.writeI32LE(o.state);
    w.writeI32LE(o.assetId); w.writeI32LE(o.score); w.writeI32LE(o.downTimer);
  }
  for (const a of s.assets) {
    w.writeI32LE(a.id); w.writeI32LE(a.type); w.writeI32LE(a.team);
    w.writeI32LE(a.state); w.writeI32LE(a.x); w.writeI32LE(a.y);
    w.writeI32LE(a.targetX); w.writeI32LE(a.targetY);
    w.writeI32LE(a.hp); w.writeI32LE(a.operatorId);
    w.writeU8(a.moveProgress);
  }
  const { hashHi, hashLo } = computeFnv1a64(w.toBytes());
  return hashToHex64(hashHi, hashLo);
}

let s = createInitialState(42, "frontier_corridor");
console.log("=== Milestone 1A Headless Simulation ===\n");
console.log(`Tick 0 — initial state hash: ${stateHash(s)}`);

// Setup: two operators join and select assets
const setup = [
  { type: "join_operator", operatorId: 0, team: 0 },
  { type: "join_operator", operatorId: 1, team: 1 },
  { type: "select_asset",  operatorId: 0, assetId: 0 },
  { type: "select_asset",  operatorId: 1, assetId: 4 },
  { type: "move_order",    operatorId: 0, targetCellX: 63, targetCellY: 63 },
  { type: "move_order",    operatorId: 1, targetCellX: 64, targetCellY: 63 },
];
for (const cmd of setup) {
  s = apply(s, cmd);
  if (s.events.length) console.log(`  setup: ${s.events.map(e=>e.type).join(", ")}`);
}

// Advance 60 ticks
for (let t = 1; t <= 60; t++) {
  s = apply(s, { type: "advance_tick" });
  if (s.events.length || t % 10 === 0) {
    const h = stateHash(s);
    const a0 = s.assets[0];
    const a4 = s.assets[4];
    console.log(`Tick ${String(s.tick).padStart(3)} | hash: ${h} | A0(${(a0.x/256).toFixed(1)},${(a0.y/256).toFixed(1)}) st:${a0.state} | A4(${(a4.x/256).toFixed(1)},${(a4.y/256).toFixed(1)}) st:${a4.state}${s.events.length ? " | "+s.events.map(e=>e.type).join(",") : ""}`);
  }
}

// Fog view check
const viewA = buildView(s, 0);
const viewB = buildView(s, 1);
console.log(`\nFog view team A: ${viewA.friendlyAssets.length} friendly, ${viewA.visibleEnemies.length} visible enemies`);
console.log(`Fog view team B: ${viewB.friendlyAssets.length} friendly, ${viewB.visibleEnemies.length} visible enemies`);
console.log(`\nFinal state hash: ${stateHash(s)}`);
