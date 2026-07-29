// debugging/dbg_field_repair.mjs — does the AI field-repair doctrine
// actually FIRE, and does it move the recovery economy?
//
// The worry worth measuring: patching mauled hulls should mean fewer of
// them become wrecks, which would show up as FEWER tows — and tows are
// how B1's tickets come back. If tows collapse, the doctrine is paying
// for itself with the rescue economy and the cap needs revisiting.
//
//   node debugging/dbg_field_repair.mjs

import { GameServer } from "../engine/server.js";

const SEEDS = (process.env.SEEDS || "1,2,3,4,5").split(",").map(Number);
const TICKS = Number(process.env.TICKS || 18000);

let tot = { repairs: 0, tows: 0, restored: 0, downs: 0, wars: 0, firedWars: 0 };

for (const seed of SEEDS) {
  const war = new GameServer({ mapSeed: seed, enableAi: true, aiDifficulty: 1 });
  const c = { asset_field_repaired: 0, tow_started: 0, asset_restored: 0, asset_disabled: 0 };
  for (let i = 0; i < TICKS && war.state.phase === 0; i++) {
    war.step();
    for (const e of war.state.events) if (e.type in c) c[e.type] += 1;
  }
  tot.wars += 1;
  tot.repairs += c.asset_field_repaired;
  tot.tows += c.tow_started;
  tot.restored += c.asset_restored;
  tot.downs += c.asset_disabled;
  if (c.asset_field_repaired > 0) tot.firedWars += 1;
  console.log(
    `seed ${seed}: ticks ${war.state.tick} | field repairs ${c.asset_field_repaired} ` +
    `| tows ${c.tow_started} restored ${c.asset_restored} | disables ${c.asset_disabled}`
  );
}

const per = (n) => (n / tot.wars).toFixed(1);
console.log(
  `\ntotals: repairs fired in ${tot.firedWars}/${tot.wars} wars ` +
  `| per war: repairs ${per(tot.repairs)} tows ${per(tot.tows)} ` +
  `restored ${per(tot.restored)} disables ${per(tot.downs)}`
);
if (tot.repairs === 0) {
  console.log("VERDICT: the doctrine NEVER FIRED — decoration, not behaviour.");
} else {
  console.log(
    "VERDICT: the doctrine fires. Compare tows/war against the pre-doctrine\n" +
    "baseline (~20 on frontier): a large drop would mean field repair is\n" +
    "cannibalising the recovery economy B1 depends on."
  );
}
