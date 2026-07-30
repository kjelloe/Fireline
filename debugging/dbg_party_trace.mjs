// Why doesn't the raid party form? Trace designation per plan pass.
import { GameServer } from "../engine/server.js";

const server = new GameServer({
  mapSeed: Number(process.env.SEED ?? 2026), enableAi: true, rules: { powPreplaced: 2 },
});
const TICKS = Number(process.env.TICKS ?? 8000);
let lastLine = "";
for (let t = 0; t < TICKS; t++) {
  server.step();
  const s = server.state;
  for (const team of [0, 1]) {
    const d = server.ai?.raidDebug?.[team];
    if (!d || d.tick < s.tick - 1) continue;
    const line = `team ${team}: op=${d.opId} asset=${d.assetId ?? "-"} esc=${d.escorts ?? "-"} ` +
      `guards=${d.guards ?? "-"} phase=${d.phase ?? "-"} dive=${d.dive ?? "-"} cell=${JSON.stringify(d.raiderCell ?? null)} stage=${JSON.stringify(d.stage ?? null)} escCells=${JSON.stringify(d.escortCells ?? null)} ${d.reason ?? ""}`;
    if (line !== lastLine) {
      console.log(`t=${s.tick} ${line}`);
      lastLine = line;
    }
  }
  if (s.winner !== -1) break;
}
