// Prompt 221 probe: the gate pile-up. Friendly hulls never hard-block
// (compression law), so a column CAN stack visually. Questions:
// (a) do >=3 same-team ACTIVE hulls stack (pairwise Chebyshev < 128)
//     and STAY stacked for 300+ ticks (the reported "traffic jam")?
// (b) does a stacked defender with ammo IGNORE an enemy in fire range
//     for 100+ ticks (the reported "not responding")?
import { GameServer } from "../engine/server.js";
import { getUnitStats } from "../engine/units.js";
import { computeVisible } from "../engine/los.js";

const ASSET_DISABLED = 2, ASSET_SALVAGED = 3;
const seeds = [2026, 777, 31337];
for (const seed of seeds) {
  const server = new GameServer({ mapSeed: seed, enableAi: true, aiDifficulty: 2 });
  const stackSince = new Map(); // key -> firstTick
  let worstStack = null, worstIgnore = null;
  for (let i = 0; i < 12000; i++) {
    server.step();
    const s = server.state;
    const alive = s.assets.filter((a) =>
      a.state !== ASSET_DISABLED && a.state !== ASSET_SALVAGED && a.team >= 0);
    // clusters: same-team pairs closer than 128 world units
    const clusters = new Map(); // anchorId -> members
    for (const a of alive) {
      for (const b of alive) {
        if (b.id <= a.id || b.team !== a.team) continue;
        if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) < 128) {
          const c = clusters.get(a.id) ?? new Set([a.id]);
          c.add(b.id);
          clusters.set(a.id, c);
        }
      }
    }
    for (const [anchor, members] of clusters) {
      if (members.size < 3) continue;
      const key = `${anchor}:${[...members].sort().join(",")}`;
      if (!stackSince.has(key)) stackSince.set(key, s.tick);
      const dur = s.tick - stackSince.get(key);
      if (!worstStack || dur > worstStack.dur) {
        const a = s.assets[anchor];
        worstStack = { dur, tick: s.tick, team: a.team,
          cell: [Math.round(a.x / 256), Math.round(a.y / 256)],
          ids: [...members] };
      }
    }
    for (const key of stackSince.keys()) {
      const [anchor] = key.split(":");
      if (!clusters.has(+anchor)) stackSince.delete(key);
    }
    // passive defender: enemy in range, has ammo, never suppressed, no shot
    const vis = [computeVisible(s, 0), computeVisible(s, 1)];
    for (const a of alive) {
      const st = getUnitStats(a.type);
      if (st.damage <= 0 || a.ammo <= 0) { continue; }
      const foe = alive.find((b) => b.team !== a.team && b.team >= 0 &&
        vis[a.team].has(b.id) &&
        Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= st.range &&
        Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) >= st.minRange);
      const u = a._probe ?? (a._probe = {});
      if (foe && a.suppressedTimer === 0) {
        u.ignoring = (u.ignoring ?? 0) + 1;
        if (!worstIgnore || u.ignoring > worstIgnore.dur) {
          worstIgnore = { dur: u.ignoring, tick: s.tick, id: a.id, type: st.name,
            team: a.team, foe: foe.id,
            cell: [Math.round(a.x / 256), Math.round(a.y / 256)] };
        }
      } else u.ignoring = 0;
    }
    const shooters = new Set(s.events.filter((e) => e.type === "fire_resolved")
      .map((e) => e.attackerId));
    for (const a of alive) if (shooters.has(a.id) && a._probe) a._probe.ignoring = 0;
  }
  console.log(`seed ${seed}: worst stack`, JSON.stringify(worstStack));
  console.log(`seed ${seed}: worst ignore`, JSON.stringify(worstIgnore));
}
