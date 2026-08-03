// CENTRE DUEL micro-trace (prompt 170). First blood is t=546 in EVERY
// seed: A logistics #9 dies at (63,63) two ticks before its mirror twin
// B #21 at (64,63). Deterministic micro-case: seed 2026, ticks 400-560 —
// every fire_resolved with attacker/target id, team, type, positions,
// and the twins' hp per tick. The first asymmetric line names the law.
import { GameServer } from "../engine/server.js";
import { getUnitStats } from "../engine/units.js";

const server = new GameServer({ mapSeed: 2026, enableAi: true, uniqueCrewing: true });
const WATCH = new Set([9, 21]);
let lastHp = {};
for (let t = 0; t < 560; t++) {
  server.step();
  const s = server.state;
  for (const id of WATCH) {
    const a = s.assets[id];
    if (!a) continue;
    const key = `${id}`;
    const cur = `${a.hp}@(${a.x},${a.y})`;
    if (s.tick >= 500 && lastHp[key] !== cur) {
      console.log(`t=${s.tick} #${id} ${a.team === 0 ? "A" : "B"} hp=${a.hp} pos=(${a.x},${a.y}) cell=(${a.x >> 8},${a.y >> 8}) state=${a.state}`);
      lastHp[key] = cur;
    }
  }
  for (const e of s.events) {
    if (e.type !== "fire_resolved") continue;
    const atk = s.assets[e.attackerId], tgt = s.assets[e.targetId];
    if (!atk || !tgt) continue;
    if (s.tick < 400) continue;
    const mark = WATCH.has(e.attackerId) || WATCH.has(e.targetId) ? " *" : "";
    console.log(
      `t=${s.tick} FIRE ${atk.team === 0 ? "A" : "B"}#${e.attackerId}(${getUnitStats(atk.type)?.name}) @(${atk.x >> 8},${atk.y >> 8}) -> ` +
      `${tgt.team === 0 ? "A" : "B"}#${e.targetId}(${getUnitStats(tgt.type)?.name}) @(${tgt.x >> 8},${tgt.y >> 8}) hp->${tgt.hp}${mark}`
    );
  }
}
