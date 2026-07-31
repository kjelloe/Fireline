// Convoy Escort mode probe: 5 seeds x both attacker sides. Healthy =
// mixed outcomes (deliveries AND stops), the recovery loop firing
// (convoy towed/repaired), and no war outrunning the mission clock
// into limbo (the timer decides by construction).
import { GameServer } from "../engine/server.js";

const REASONS = { 1: "elim", 6: "DELIVERED", 7: "STOPPED" };
for (const attacker of [0, 1]) {
  for (const seed of [2026, 777, 31337, 4242, 9001]) {
    const server = new GameServer({
      mapSeed: seed, enableAi: true,
      rules: { mode: 1, modeAttacker: attacker },
    });
    let stops = 0, tows = 0, pings = 0, restarts = 0;
    const convoyId = server.state.mission.convoyId;
    let bestDist = Infinity;
    for (let t = 0; t < 20000; t++) {
      server.step();
      const s = server.state;
      for (const e of s.events) {
        if (e.type === "convoy_ping") pings++;
        if (e.type === "tow_started" && e.assetId === convoyId) tows++;
        if (e.type === "convoy_restarted") restarts++;
        if (e.type === "asset_disabled" && e.assetId === convoyId) stops++;
      }
      const c = s.assets[convoyId];
      if (c) {
        const d = Math.max(Math.abs(((c.x / 256) | 0) - s.mission.gateCellX),
                           Math.abs(((c.y / 256) | 0) - s.mission.gateCellY));
        if (d < bestDist) bestDist = d;
      }
      if (s.winner !== -1 || s.phase === 1) break;
    }
    const s = server.state;
    console.log(
      `att=${attacker} seed ${String(seed).padStart(5)}: winner=${s.winner} ` +
      `(${REASONS[s.winReason] ?? s.winReason}) tick=${s.tick} ` +
      `convoyWrecked=${stops} restarts=${restarts} convoyTows=${tows} pings=${pings} timerLeft=${s.mission.timerTicks} bestDistToGate=${bestDist}`);
  }
}
