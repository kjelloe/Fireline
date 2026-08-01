// dbg_heart_hold.mjs — prompt 136 discriminator: on riverline, how many
// ticks does either team hold BOTH heart relays (4,5), and how many of
// those ticks are under-majority (i.e. the new bleed actually fires)?
import { GameServer } from "../engine/server.js";

const seed = Number(process.env.SEED ?? 2026);
const server = new GameServer({
  mapSeed: seed, enableAi: true, aiDifficulty: 1, mapProfile: "riverline",
  uniqueCrewing: true,
});
let heartTicks = [0, 0];
let heartUnderMajority = [0, 0];
let ownedLog = new Map();
let stalemate = 0;
let lastT = 0;
for (let t = 0; t < 18000; t++) {
  server.step();
  const s = server.state;
  const owned = [0, 0];
  for (const site of s.sites) if (site.owner === 0 || site.owner === 1) owned[site.owner]++;
  const o4 = s.sites[4].owner, o5 = s.sites[5].owner;
  if (o4 !== -1 && o4 === o5) {
    heartTicks[o4]++;
    if (owned[o4] < 4) heartUnderMajority[o4]++;
  }
  if (owned[0] < 4 && owned[1] < 4) stalemate++;
  lastT = t;
  const key = `${s.sites.map((x) => x.owner).join("")}`;
  ownedLog.set(key, (ownedLog.get(key) ?? 0) + 1);
  if (s.events.some((e) => e.type === "game_over")) {
    console.log("over at", t, s.events.find((e) => e.type === "game_over"));
    break;
  }
}
console.log("heart-pair held ticks (A,B):", heartTicks);
console.log("stalemate ticks (nobody at majority):", stalemate, "of", lastT);
console.log("  of which UNDER majority:", heartUnderMajority);
console.log("top ownership patterns:", [...ownedLog.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6));
console.log("tickets:", server.state.tickets);
