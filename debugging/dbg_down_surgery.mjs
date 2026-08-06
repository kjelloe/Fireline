// prompt 205: why does an acceptance-surgery downed entry not reach the
// view? Reproduce headless: join a human, crew a hull, surgically down
// the seat the way the acceptance harness does, tick, inspect.
import { GameServer } from "../engine/server.js";
import { createDowned } from "../engine/downed.js";
import { buildView } from "../engine/view.js";

const gs = new GameServer({ mapSeed: 2026, enableAi: true });
gs.enqueue({ type: "join_operator", operatorId: 0, team: 0 });
gs.enqueue({ type: "select_asset", operatorId: 0, assetId: 0, confirm: true });
for (let i = 0; i < 5; i++) gs.step();

const st = gs.state;
const mine = st.assets.find((a) => a.operatorId === 0);
console.log("crewed:", mine?.id, "state:", mine?.state);
const seat = st.operators[0];
seat.state = 2;
seat.assetId = -1;
st.downed.push(createDowned(seat, mine));
mine.state = 2;
mine.operatorId = -1;
console.log("post-surgery downed:", st.downed.map((d) => d.operatorId));

for (let i = 0; i < 5; i++) {
  gs.step();
  const cur = gs.state;
  console.log(`tick ${cur.tick}: downed=[${cur.downed.map((d) => d.operatorId)}] op0.state=${cur.operators[0].state} op0.assetId=${cur.operators[0].assetId} asset0.state=${cur.assets[0].state}`);
}
const view = buildView(gs.state, 0);
console.log("view.downedOperators:", JSON.stringify(view.downedOperators));
