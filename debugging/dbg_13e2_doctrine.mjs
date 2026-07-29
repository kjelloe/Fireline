// debugging/dbg_13e2_doctrine.mjs — does the bridge doctrine actually
// FIRE? Escort doctrine needed three probe-forced iterations because the
// first two versions never triggered in a real war, and a doctrine that
// never fires looks exactly like a doctrine that works.
//
//   node debugging/dbg_13e2_doctrine.mjs

import { GameServer } from "../engine/server.js";

const SEEDS = (process.env.SEEDS || "1,2,3,4,5").split(",").map(Number);
const TICKS = Number(process.env.TICKS || 18000);

let totals = { shelled: 0, breached: 0, repaired: 0, wars: 0, breachedWars: 0 };

for (const seed of SEEDS) {
  const war = new GameServer({
    mapSeed: seed, enableAi: true, aiDifficulty: 1, mapProfile: "riverline",
  });
  const c = { bridge_shelled: 0, bridge_breached: 0, bridge_repaired: 0 };
  let downTicks = 0;
  for (let i = 0; i < TICKS && war.state.phase === 0; i++) {
    war.step();
    for (const e of war.state.events) if (e.type in c) c[e.type] += 1;
    if ((war.state.bridges ?? []).some((b) => b.hp <= 0)) downTicks += 1;
  }
  totals.wars += 1;
  totals.shelled += c.bridge_shelled;
  totals.breached += c.bridge_breached;
  totals.repaired += c.bridge_repaired;
  if (c.bridge_breached > 0) totals.breachedWars += 1;
  const pct = ((downTicks / Math.max(1, war.state.tick)) * 100).toFixed(1);
  console.log(
    `seed ${seed}: ticks ${war.state.tick} | shelled ${c.bridge_shelled} ` +
    `breached ${c.bridge_breached} repaired ${c.bridge_repaired} ` +
    `| a span was DOWN ${pct}% of the war | final hp ${(war.state.bridges ?? []).map((b) => b.hp).join("/")}`
  );
}

console.log(
  `\ntotals: ${totals.breachedWars}/${totals.wars} wars saw a bridge dropped; ` +
  `${totals.shelled} shells, ${totals.breached} breaches, ${totals.repaired} rebuilds`
);
if (totals.shelled === 0) {
  console.log("VERDICT: the doctrine NEVER FIRED — it is decoration, not behaviour.");
} else if (totals.breached === 0) {
  console.log("VERDICT: tubes shell spans but never finish one — check hp vs damage/range.");
} else if (totals.repaired === 0) {
  console.log("VERDICT: spans drop but NOBODY rebuilds — the truck errand is not reaching them.");
} else {
  console.log("VERDICT: the full cycle fires — drop and rebuild both happen.");
}
