// If apply is pure, re-deriving tick T from any checkpoint equals linear.
import { GameServer } from "../engine/server.js";
import { apply } from "../engine/reducer.js";
import { createInitialState } from "../engine/state.js";
import { hashState } from "../engine/snapshot.js";

const server = new GameServer({ mapSeed: 4242, enableAi: true, aiDifficulty: 1 });
for (let i = 0; i < 600 && server.state.phase === 0; i++) server.step();
const log = server.commandLog;

// Linear replay, keeping a reference to the state at entry index 300.
let s = createInitialState(4242, "frontier_corridor");
let snap300 = null;
const linearHashes = [];
for (let i = 0; i < log.length; i++) {
  s = apply(s, log[i].cmd);
  if (i === 299) snap300 = s;
  linearHashes.push(null);
}
const finalLinear = hashState(s);
const snapHashAtCapture = hashState(snap300);

// Now re-apply from the saved reference and compare.
let t = snap300;
for (let i = 300; i < log.length; i++) t = apply(t, log[i].cmd);
console.log("final linear:", finalLinear);
console.log("final from-checkpoint:", hashState(t));
console.log("checkpoint hash NOW vs AT CAPTURE:", hashState(snap300) === snapHashAtCapture ? "unchanged" : "MUTATED AFTER CAPTURE");
