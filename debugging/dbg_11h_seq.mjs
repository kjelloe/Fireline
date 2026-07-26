import { GameServer } from "../engine/server.js";
import { hashState } from "../engine/snapshot.js";
import { createReplayPlayer } from "../client/js/replay_engine.js";

const server = new GameServer({ mapSeed: 4242, enableAi: true, aiDifficulty: 1 });
const hashes = new Map();
for (let i = 0; i < 600 && server.state.phase === 0; i++) {
  server.step();
  if (server.state.tick % 100 === 0) hashes.set(server.state.tick, hashState(server.state));
}
const record = { meta: { mapSeed: 4242, ticks: server.state.tick }, commandLog: server.commandLog };
console.log("final tick", server.state.tick, "log entries", server.commandLog.length);

const player = createReplayPlayer(record, { checkpointEvery: 150 });
for (const [tick, want] of hashes) {
  const ok = hashState(player.seek(tick)) === want;
  console.log("fwd", tick, ok ? "ok" : "MISMATCH", "cursorTick", player.state.tick);
}
player.seek(server.state.tick);
for (const [tick, want] of [...hashes].reverse()) {
  const got = hashState(player.seek(tick));
  console.log("bwd", tick, got === want ? "ok" : `MISMATCH stateTick=${player.state.tick}`);
}
