// Heist mode probe: 5 seeds x both attacker sides. Healthy = grabs
// happen (the raid doctrine fires with one standard), some scores,
// some vault holds — a contested mode, not a dead one.
import { GameServer } from "../engine/server.js";

const REASONS = { 1: "elim", 4: "SCORED", 8: "VAULT-HELD" };
for (const attacker of [0, 1]) {
  for (const seed of [2026, 777, 31337, 4242, 9001]) {
    const server = new GameServer({
      mapSeed: seed, enableAi: true,
      rules: { mode: 2, modeAttacker: attacker },
    });
    let grabs = 0, drops = 0, pings = 0;
    for (let t = 0; t < 20000; t++) {
      server.step();
      const s = server.state;
      for (const e of s.events) {
        if (e.type === "standard_taken") grabs++;
        if (e.type === "standard_dropped") drops++;
        if (e.type === "ping" && e.kind === "heist_asset") pings++;
      }
      if (s.winner !== -1 || s.phase === 1) break;
    }
    const s = server.state;
    console.log(
      `att=${attacker} seed ${String(seed).padStart(5)}: winner=${s.winner} ` +
      `(${REASONS[s.winReason] ?? s.winReason}) tick=${s.tick} grabs=${grabs} drops=${drops} pings=${pings} timerLeft=${s.mission.timerTicks}`);
  }
}
