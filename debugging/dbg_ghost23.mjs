// Prompt 219 probe: find the SECOND ghost creator. Seed 1234, diff 2 —
// operator 23 ghosts (OP_DOWN, no body, no bunk) at tick 3708.
import { GameServer } from "../engine/server.js";

const OP_DOWN = 2;
const server = new GameServer({ mapSeed: 1234, enableAi: true, aiDifficulty: 2 });
let prevState = null;

for (let i = 0; i < 4000; i++) {
  server.step();
  const s = server.state;
  const events = s.events.filter((e) =>
    e.operatorId === 23 ||
    (e.assetId !== undefined && s.assets[e.assetId]?.operatorId === 23));
  for (const e of events) console.log(s.tick, JSON.stringify(e));
  const o = s.operators[23];
  if (o.state === OP_DOWN) {
    const hasBody = s.downed.some((d) => d.operatorId === 23);
    const hasBunk = s.assets.some((a) => a.aboard1 === 23 || a.aboard2 === 23);
    if (!hasBody && !hasBunk) {
      console.log(`GHOST at tick ${s.tick}: op23 state=${o.state} assetId=${o.assetId}`);
      console.log("last 30 events this tick:", JSON.stringify(s.events.slice(-30), null, 1));
      // what the previous tick said about op 23
      if (prevState) {
        const po = prevState.operators[23];
        const pBody = prevState.downed.find((d) => d.operatorId === 23);
        const pBunk = prevState.assets.find((a) => a.aboard1 === 23 || a.aboard2 === 23);
        console.log("prev tick:", prevState.tick, "state", po.state, "assetId", po.assetId,
          "body", JSON.stringify(pBody), "bunk", pBunk ? pBunk.id : null);
      }
      process.exit(0);
    }
  }
  prevState = s;
}
console.log("no ghost found");
