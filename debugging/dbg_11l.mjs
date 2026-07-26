import { apply } from "../engine/reducer.js";
import { sandbox, joinAndSelect } from "../test/helpers.js";
let s = sandbox([
  { team: 0, cellX: 10, driveThrottle: 1 },
  { team: 1, cellX: 12, hp: 10 },
  { team: 0, cellX: 50 },
]);
s = joinAndSelect(s, 16, 1, 1);
s = apply(s, { type: "fire_order", operatorId: 16, targetAssetId: 0 });
console.log(s.events, "a0 state", s.assets[0].state, "hp", s.assets[0].hp, "throttle", s.assets[0].driveThrottle);
