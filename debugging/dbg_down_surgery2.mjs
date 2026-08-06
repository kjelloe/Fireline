// prompt 210: who reseats a surgically-downed HUMAN within ~10 ticks?
import { GameServer } from "../engine/server.js";
import { createDowned } from "../engine/downed.js";

const gs = new GameServer({ mapSeed: 2026, enableAi: true });
gs.enqueue({ type: "join_operator", operatorId: 0, team: 0 });
for (let i = 0; i < 3; i++) gs.step();
// auto-select equivalent: seat op 0 in asset 0
gs.enqueue({ type: "select_asset", operatorId: 0, assetId: 0, confirm: true });
for (let i = 0; i < 600; i++) gs.step(); // 60s of war — the acceptance timeframe

const st = gs.state;
const mine = st.assets.find((a) => a.operatorId === 0);
console.log("at tick", st.tick, "op0 crews", mine?.id);
const seat = st.operators[0];
seat.state = 2; seat.assetId = -1;
const body = createDowned(seat, mine);
body.x = 118 * 256 + 128; body.y = 10 * 256 + 128;
body.targetX = body.x; body.targetY = body.y;
st.downed.push(body);
mine.state = 2; mine.operatorId = -1;

for (let i = 0; i < 15; i++) {
  gs.step();
  const cur = gs.state;
  const ev = cur.events.filter((e) => e.operatorId === 0 || e.assetId === mine.id);
  const down = cur.downed.some((d) => d.operatorId === 0);
  const op = cur.operators[0];
  console.log(`t${cur.tick} down=${down} op.state=${op.state} op.asset=${op.assetId} ev=${JSON.stringify(ev)}`);
  if (!down && op.assetId !== -1) break;
}
