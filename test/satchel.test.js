// test/satchel.test.js — prompt-51 AT satchel: the downed crew's one
// heroic answer to armor. One charge per bail-out, adjacent-cell only,
// LOUD (event + team ping), kill credit to the operator.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, SATCHEL_DAMAGE, RECOG_KILL } from "../engine/reducer.js";
import { ASSET_DISABLED } from "../engine/state.js";
import { sandbox, joinAndSelect } from "./helpers.js";

function downedNextTo(enemyHp = 100) {
  let s = sandbox([
    { team: 0, cellX: 20, cellY: 20 },                    // will be downed crew's hull
    { team: 1, cellX: 21, cellY: 20, hp: enemyHp },       // adjacent enemy tank
    { team: 1, cellX: 60, cellY: 60 },                    // far enemy — war continues
    { team: 0, cellX: 5, cellY: 5 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s.assets[0].state = ASSET_DISABLED;
  s.assets[0].hp = 0;
  s.operators[0].state = 2; // OP_DOWN
  s.operators[0].assetId = -1;
  s.downed.push({
    operatorId: 0, team: 0, x: s.assets[0].x, y: s.assets[0].y,
    targetX: s.assets[0].x, targetY: s.assets[0].y, downTicks: 5, satchel: 1,
  });
  return s;
}

test("satchel: adjacent blast damages, spends the charge, and is LOUD", () => {
  let s = downedNextTo(100);
  s = apply(s, { type: "satchel", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.assets[1].hp, 100 - SATCHEL_DAMAGE);
  assert.ok(s.events.some((e) => e.type === "satchel_detonated"));
  assert.ok(s.events.some((e) => e.type === "ping" && e.kind === "satchel_blast"),
    "the blast pings the team — loud by ruling");
  assert.equal(s.downed.find((d) => d.operatorId === 0).satchel, 0);
  const again = apply(s, { type: "satchel", operatorId: 0, targetAssetId: 1 });
  assert.equal(again.events[0].reason, "satchel spent");
});

test("satchel: a weakened tank dies to it and the operator takes the kill credit", () => {
  let s = downedNextTo(50);
  const before = s.operators[0].score;
  s = apply(s, { type: "satchel", operatorId: 0, targetAssetId: 1 });
  assert.equal(s.assets[1].state, ASSET_DISABLED, "the charge finishes it");
  assert.equal(s.operators[0].score, before + RECOG_KILL, "hero credit");
});

test("satchel: out of arm's reach and friendly targets are refused", () => {
  let s = downedNextTo(100);
  const far = apply(s, { type: "satchel", operatorId: 0, targetAssetId: 2 });
  assert.equal(far.events[0].reason, "out of arm's reach");
  const friendly = apply(s, { type: "satchel", operatorId: 0, targetAssetId: 3 });
  assert.equal(friendly.events[0].reason, "no enemy there");
});

test("satchel: every bail-out carries exactly one charge", () => {
  let s = sandbox([
    { team: 0, cellX: 20, cellY: 20, hp: 5 },
    { team: 1, cellX: 24, cellY: 20 }, // inside tank range (5 cells)
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  s = joinAndSelect(s, 1, 1, 1);
  s = apply(s, { type: "fire_order", operatorId: 1, targetAssetId: 0 });
  const down = s.downed.find((d) => d.operatorId === 0);
  assert.ok(down, "crew bailed");
  assert.equal(down.satchel, 1, "armed on the way out");
});
