// dbg_16b_uptime.mjs — per-team unique telemetry over N seeds: when was
// the unique first crewed, how long crewed, deploy uptime (sentinel),
// and war outcome. Localizes the A-residue seen in the tuned 16B sweep.
import { GameServer } from "../engine/server.js";
const N = Number(process.argv[2] ?? 10);
console.log("seed,winner,crewTickA,crewTickB,crewedTicksA,crewedTicksB,deployedTicks18");
for (let seed = 1; seed <= N; seed++) {
  const server = new GameServer({ mapSeed: seed, enableAi: true });
  const first = { 18: -1, 30: -1 };
  const crewed = { 18: 0, 30: 0 };
  let deployed18 = 0;
  for (let t = 0; t < 18000; t++) {
    server.step();
    const s = server.state;
    for (const id of [18, 30]) {
      const a = s.assets[id];
      if (a.operatorId !== -1) {
        crewed[id]++;
        if (first[id] === -1) first[id] = t;
      }
    }
    if (s.assets[18].deployed === 1) deployed18++;
    if (s.phase === 2) break;
  }
  const w = server.state.winner ?? -1;
  console.log(`${seed},${w},${first[18]},${first[30]},${crewed[18]},${crewed[30]},${deployed18}`);
}
