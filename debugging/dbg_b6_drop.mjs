// debugging/dbg_b6_drop.mjs — does the B6 supply drop actually fire and
// get SECURED in real wars? 5 gate seeds, frontier.
import { GameServer } from "../engine/server.js";

for (const seed of [2026, 777, 31337, 4242, 9001]) {
  const war = new GameServer({ mapSeed: seed, enableAi: true, aiDifficulty: 1 });
  const d0 = war.state.drops[0];
  let incoming = 0, secured = -2, securedTick = -1;
  for (let i = 0; i < 16000 && war.state.phase === 0; i++) {
    war.step();
    for (const e of war.state.events) {
      if (e.type === "supply_drop_incoming") incoming++;
      if (e.type === "supply_drop_secured") { secured = e.byTeam; securedTick = war.state.tick; }
    }
  }
  console.log(`seed ${seed}: row=${d0.cellY} activate=${d0.activateTick} ` +
    `incoming=${incoming} secured=${secured === -2 ? "NO" : `team ${secured} @${securedTick}`} ` +
    `endTick=${war.state.tick} winner=${war.state.winner}`);
}
