// test/headless/sim2a.js — 2A integration soak CLI: two scripted operators,
// full ruleset, replay verification. Run: npm run sim2a

import { runSoak } from "./soak2a.js";

const result = runSoak(2026, 1500);
for (const line of result.log) console.log(line);
console.log(`\ncaptures: ${result.captures} | disable events: ${result.disables}`);
console.log(`min ammo: ${result.minAmmo} | min fuel: ${result.minFuel}`);
console.log(`live hash:   ${result.liveHash}`);
console.log(`replay hash: ${result.replayHash}`);
console.log(result.replayHash === result.liveHash ? "REPLAY OK" : "REPLAY MISMATCH");
if (result.replayHash !== result.liveHash) process.exit(1);
