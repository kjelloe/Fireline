// POWS=2 census check: which asset TYPES does each team actually crew
// once 4 seats are locked? (Bias survives mirror AND uniques-off, so
// the suspect is roster/census asymmetry, not geometry or the pair.)
import { GameServer } from "../engine/server.js";

const server = new GameServer({ mapSeed: 2026, enableAi: true, rules: { powPreplaced: 2 } });
for (let t = 0; t < 200; t++) server.step();
const s = server.state;
for (const team of [0, 1]) {
  const crewed = s.assets
    .filter((a) => a.team === team && a.operatorId !== -1)
    .map((a) => `${a.id}:t${a.type}`);
  console.log(`team ${team}: crewed ${crewed.join(" ")}`);
}
const captive = s.operators.filter((o) => o.state === 3).map((o) => `op${o.id}(team${o.team})`);
console.log("captive:", captive.join(" "));
