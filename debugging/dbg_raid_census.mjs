// THE RAID-PARTY CENSUS (prompt 178/179). RAIDPARTY=0 moves POWS=2 from
// 39.4% to 54.2/51.2% A — the AI prison-raid party IS the POWS root.
// This names WHAT inside the party is team-keyed: per team, how often a
// party forms, how long it stays live, how many hulls it commits, what
// those hulls do to the front line while committed, how many raids
// actually complete, and what the party costs in losses.
// POWS=2, 5 seeds.
import { GameServer } from "../engine/server.js";
import { getUnitStats } from "../engine/units.js";

const T = { 0: null, 1: null };
const agg = {
  0: { formed: 0, liveTicks: 0, hullTicks: 0, committed: new Set(), losses: 0,
       raids: 0, freed: 0, noRaider: 0, advSum: 0, advN: 0 },
  1: { formed: 0, liveTicks: 0, hullTicks: 0, committed: new Set(), losses: 0,
       raids: 0, freed: 0, noRaider: 0, advSum: 0, advN: 0 },
};

for (const seed of [2026, 777, 31337, 4242, 9001]) {
  const server = new GameServer({
    mapSeed: seed, enableAi: true, uniqueCrewing: process.env.UNIQUES !== "0",
    rules: { powPreplaced: 2 },
  });
  const wasLive = { 0: false, 1: false };
  const sprung = { 0: new Set(), 1: new Set() }; // operatorIds freed from a prison
  const partyMembers = { 0: new Set(), 1: new Set() };
  for (let t = 0; t < 12000; t++) {
    server.step();
    const s = server.state;
    const rp = server.ai.raidParty ?? {};
    const dbg = server.ai.raidDebug ?? {};
    for (const team of [0, 1]) {
      const a = agg[team];
      if (dbg[team]?.reason === "no eligible raider") a.noRaider++;
      const party = rp[team];
      const live = !!party;
      if (live && !wasLive[team]) a.formed++;
      wasLive[team] = live;
      if (!live) { partyMembers[team].clear(); continue; }
      a.liveTicks++;
      // Who is committed this tick: the raider plus its escorts.
      const ids = [party.raiderOp, ...(party.escorts ?? [])].filter((x) => x >= 0);
      if (party.phase === 1) a.advancePhaseTicks = (a.advancePhaseTicks ?? 0) + 1;
      a.hullTicks += ids.length;
      for (const opId of ids) {
        a.committed.add(`${seed}:${opId}`);
        partyMembers[team].add(opId);
        // Where does a committed hull SIT? Advance from own edge — a
        // party that rallies deep in its own half is a party that is
        // not holding the line.
        const op = s.operators[opId];
        const hull = op && op.assetId >= 0 ? s.assets[op.assetId] : null;
        if (hull) {
          a.advSum += team === 0 ? (hull.x >> 8) - 7 : 120 - (hull.x >> 8);
          a.advN++;
        }
      }
    }
    for (const d of s.downed ?? []) {
      if (d.freedPow === 1 && (d.team === 0 || d.team === 1)) sprung[d.team].add(d.operatorId);
    }
    for (const e of s.events) {
      if (e.type === "asset_disabled") {
        const v = s.assets[e.assetId];
        if (!v || (v.team !== 0 && v.team !== 1)) continue;
        if (partyMembers[v.team].has(v.operatorId)) agg[v.team].losses++;
      } else if (e.type === "pow_freed" || e.type === "prison_raided") {
        const team = e.team === 0 ? 0 : 1;
        agg[team].raids++;
      } else if (e.type === "operator_delivered") {
        // operator_delivered carries no freedPow flag, so track WHO was
        // a sprung POW and count their arrivals home.
        for (const team of [0, 1]) {
          if (sprung[team].has(e.operatorId)) { agg[team].freed++; sprung[team].delete(e.operatorId); }
        }
      }
    }
    if (s.phase === 1) break;
  }
}

console.log("POWS=2, 5 seeds — the raid party by team\n");
for (const team of [0, 1]) {
  const a = agg[team];
  console.log(`TEAM ${team === 0 ? "A" : "B"}`);
  console.log(`  parties formed        ${a.formed}`);
  console.log(`  ticks with a party    ${a.liveTicks}`);
  console.log(`  hull-ticks committed  ${a.hullTicks}  (mean hulls/tick ${(a.hullTicks / Math.max(1, a.liveTicks)).toFixed(2)})`);
  console.log(`  distinct hulls used   ${a.committed.size}`);
  console.log(`  losses while committed${String(a.losses).padStart(5)}`);
  console.log(`  mean advance of a committed hull ${(a.advSum / Math.max(1, a.advN)).toFixed(1)} cells from own edge`);
  console.log(`  raid events           ${a.raids}   POWs delivered home ${a.freed}`);
  console.log(`  ticks with NO eligible raider ${a.noRaider}`);
  console.log(`  ticks in ADVANCE phase (formed up) ${a.advancePhaseTicks ?? 0}`);
  console.log("");
}
