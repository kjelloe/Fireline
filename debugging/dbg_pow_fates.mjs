// Where do the pre-placed POWs end up? (seat-return check for the
// powPreplaced default flip)
import { GameServer } from "../engine/server.js";
import { OP_CAPTIVE, OP_DOWN, OP_ACTIVE } from "../engine/state.js";

const NAMES = { [OP_CAPTIVE]: "CAPTIVE", [OP_DOWN]: "DOWN", [OP_ACTIVE]: "ACTIVE" };
for (const seed of [2026, 777, 31337, 4242, 9001]) {
  const server = new GameServer({ mapSeed: seed, enableAi: true, rules: { powPreplaced: 2 } });
  for (let t = 0; t < 16000; t++) {
    server.step();
    if (server.state.winner !== -1) break;
  }
  const s = server.state;
  const fates = [26, 27, 30, 31].map((id) => {
    const o = s.operators[id];
    const seat = o.assetId !== -1 ? ` asset${o.assetId}` : "";
    return `op${id}=${NAMES[o.state] ?? o.state}${seat}`;
  });
  console.log(`seed ${seed} (t=${s.tick}): ${fates.join(" ")}`);
}
