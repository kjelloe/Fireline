import { apply } from "../engine/reducer.js";
import { sandbox, joinSelectMove } from "../test/helpers.js";

let s = sandbox(
  [{ team: 0, cellX: 3 }, { team: 1, cellX: 6 }],
  [{ cellX: 3, owner: -1 }]
);
for (let i = 0; i < 30 && s.sites[0].owner !== 0; i++) s = apply(s, { type: "advance_tick" });
console.log("after capture:", s.sites[0]);
s = joinSelectMove(s, 1, 1, 1, 3, 0);
for (let i = 0; i < 400 && s.sites[0].owner !== 1; i++) s = apply(s, { type: "advance_tick" });
console.log("contested phase:", s.sites[0],
  "a0", s.assets[0].x, s.assets[0].y, s.assets[0].state,
  "a1", s.assets[1].x, s.assets[1].y, s.assets[1].state, s.assets[1].hp);
s = joinSelectMove(s, 0, 0, 0, 20, 20);
for (let i = 0; i < 200; i++) {
  s = apply(s, { type: "advance_tick" });
  if (i % 40 === 0) console.log(i, "site", s.sites[0], "a0cell", (s.assets[0].x/256)|0, (s.assets[0].y/256)|0);
  if (s.sites[0].owner === 1) { console.log("FLIPPED at", i); break; }
}
console.log("final:", s.sites[0]);
