// Config check: heist att=1 WITH unique crewing (the battery's config).
import { GameServer } from "../engine/server.js";
for (const seed of [2026, 777, 31337]) {
  const server = new GameServer({
    mapSeed: seed, enableAi: true, uniqueCrewing: true,
    rules: { mode: 2, modeAttacker: 1 },
  });
  for (let t = 0; t < 9500; t++) {
    server.step();
    if (server.state.phase === 1) break;
  }
  const s = server.state;
  console.log(`seed ${seed}: winner=${s.winner} reason=${s.winReason} tick=${s.tick}`);
}
