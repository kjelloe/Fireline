import { GameServer } from "../engine/server.js";
import { inSupply } from "../engine/supply.js";

const server = new GameServer({ mapSeed: 777, enableAi: true, aiDifficulty: 1 });
const S = () => server.state;
console.log("sites:", S().sites.map(s => ({ id: s.id, x: s.cellX, y: s.cellY, owner: s.owner })));
console.log("bases:", S().bases);
for (let i = 0; i < 1200; i++) {
  server.step();
  const ev = S().events.filter(e => ["site_captured","site_neutralized","asset_disabled"].includes(e.type));
  for (const e of ev) {
    if (e.type === "asset_disabled") {
      const a = S().assets[e.assetId];
      console.log(S().tick, "DISABLED", e.assetId, "team", a.team, "at", (a.x/256)|0, (a.y/256)|0, "supplied", inSupply(S(), a));
    } else {
      console.log(S().tick, e.type, e.siteId, "team" in e ? e.team : e.byTeam);
    }
  }
}
const alive = [0,1].map(t => S().assets.filter(a => a.team === t && a.state !== 2 && a.state !== 3).length);
console.log("operable after 1200:", alive, "scores", S().teamScores);
