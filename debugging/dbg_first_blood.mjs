// FIRST BLOOD drill (prompt 170). The line instrument named the mover:
// first-contact resolution (pre-contact advance is symmetric to 0.0;
// A loses the opening exchange 31v18 POWS=0, 8-0 POWS=2). This probe
// reconstructs the first 4 disables per seed: the victim, the killer,
// the full shot ledger of that pairing (who acquired first, shots each
// way), whether the victim was moving, and how many DISTINCT enemies
// hit the victim (focus fire?). 5 seeds, POWS=0.
import { GameServer } from "../engine/server.js";
import { getUnitStats } from "../engine/units.js";

const tally = { firstShotByKillerTeam: { 0: 0, 1: 0 }, victimNeverFired: 0, focus: 0, n: 0 };
for (const seed of [2026, 777, 31337, 4242, 9001]) {
  const server = new GameServer({ mapSeed: seed, enableAi: true, uniqueCrewing: true });
  const shots = new Map(); // "a-b" ordered pair -> count; also first-shot tick per unordered pair
  const firstShot = new Map(); // unordered key -> {tick, shooter}
  const hitBy = new Map(); // victimId -> Set of attacker ids
  let disables = 0;
  console.log(`--- seed ${seed} ---`);
  for (let t = 0; t < 4000 && disables < 4; t++) {
    server.step();
    const s = server.state;
    for (const e of s.events) {
      if (e.type === "fire_resolved") {
        const atk = s.assets[e.attackerId], tgt = s.assets[e.targetId];
        if (!atk || !tgt || atk.team === tgt.team || atk.team < 0 || tgt.team < 0) continue;
        shots.set(`${e.attackerId}>${e.targetId}`, (shots.get(`${e.attackerId}>${e.targetId}`) ?? 0) + 1);
        const uk = `${Math.min(e.attackerId, e.targetId)}-${Math.max(e.attackerId, e.targetId)}`;
        if (!firstShot.has(uk)) firstShot.set(uk, { tick: s.tick, shooter: e.attackerId, team: atk.team });
        if (!hitBy.has(e.targetId)) hitBy.set(e.targetId, new Set());
        hitBy.get(e.targetId).add(e.attackerId);
      } else if (e.type === "asset_disabled" && e.byType >= 0) {
        const v = s.assets[e.assetId];
        if (!v || (v.team !== 0 && v.team !== 1)) continue;
        disables++;
        tally.n++;
        const killers = hitBy.get(e.assetId) ?? new Set();
        const uk = `${Math.min(e.assetId, e.by)}-${Math.max(e.assetId, e.by)}`;
        const fs = firstShot.get(uk);
        const back = shots.get(`${e.assetId}>${e.by}`) ?? 0;
        const inc = shots.get(`${e.by}>${e.assetId}`) ?? 0;
        if (fs) tally.firstShotByKillerTeam[fs.team === (v.team === 0 ? 1 : 0) ? 1 : 0]++;
        if (back === 0) tally.victimNeverFired++;
        if (killers.size > 1) tally.focus++;
        console.log(
          `t=${s.tick} ${v.team === 0 ? "A" : "B"} ${getUnitStats(v.type)?.name} #${e.assetId} ` +
          `@(${v.x >> 8},${v.y >> 8}) killed by ${getUnitStats(e.byType)?.name} #${e.by}; ` +
          `pair first shot t=${fs?.tick} by ${fs?.shooter === e.by ? "KILLER" : "victim"}; ` +
          `shots killer>victim ${inc}, victim>killer ${back}; distinct attackers ${killers.size}` +
          `${v.state === 1 ? "; victim MOVING" : ""}`
        );
      }
    }
  }
}
console.log(`\nacross ${tally.n} first-blood disables: pair-first-shot was the KILLER's team ${tally.firstShotByKillerTeam[1]}x, the victim's ${tally.firstShotByKillerTeam[0]}x; victim never fired back ${tally.victimNeverFired}x; focus-fired (2+ attackers) ${tally.focus}x`);
