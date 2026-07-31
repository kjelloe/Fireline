// test/alarm_guards.test.js — specs/12 Q38, "alarm-only guards first".
// The watchman is not an entity: indestructible and unarmed by
// construction (nothing exists to shoot). His shout is a toTeam ping
// with a hashed cooldown, and the shout pulls a defender home.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { AIRegency } from "../engine/ai_regency.js";
import { ALARM_COOLDOWN_TICKS, GUARD_SENSE_CELLS } from "../engine/prisons.js";
import { sandbox, joinAndSelect } from "./helpers.js";

function prisonWorld(extra = []) {
  let s = sandbox([
    { team: 1, type: 0, cellX: 12, cellY: 30 }, // intruder at the wire
    ...extra,
  ], [], {
    bases: [
      { team: 0, x: 0, y: 0, width: 4, height: 4 },
      { team: 1, x: 60, y: 60, width: 4, height: 4 },
    ],
  });
  s.prisons = [{ team: 0, cellX: 10, cellY: 30, pows: [{ id: 30, by: -1 }], raidTicks: 0, alarmTicks: 0 }];
  s = joinAndSelect(s, 20, 1, 0);
  return s;
}

test("alarm: an intruder at the wire trips a toTeam ping, once per cooldown", () => {
  let s = prisonWorld();
  s = apply(s, { type: "advance_tick" });
  const alarm = s.events.find((e) => e.type === "ping" && e.kind === "prison_alarm");
  assert.ok(alarm, "the watchman shouts");
  assert.equal(alarm.toTeam, 0, "the DEFENDERS hear it");
  assert.equal(s.prisons[0].alarmTicks, ALARM_COOLDOWN_TICKS);
  // The cooldown holds even with the intruder parked at the wire.
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.events.some((e) => e.kind === "prison_alarm"), false, "one shout per cooldown");
});

test("alarm: silence when nobody is near, and the cooldown decays", () => {
  let s = prisonWorld();
  s.assets[0].x = 40 * 256 + 128; // intruder far away
  s.prisons[0].alarmTicks = 2;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.events.some((e) => e.kind === "prison_alarm"), false);
  assert.equal(s.prisons[0].alarmTicks, 1, "cooldown decays");
});

test("alarm: the response — a free defender combat hull rides for the compound", () => {
  const s = prisonWorld([{ team: 0, type: 0, cellX: 40, cellY: 40 }]);
  let s2 = apply(s, { type: "join_operator", operatorId: 21, team: 0 });
  s2 = apply(s2, { type: "select_asset", operatorId: 21, assetId: 1, confirm: true });
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(21);
  const mv = ai.plan(s2).find((c) => c.type === "move_order" && c.operatorId === 21);
  assert.ok(mv, "a defender is designated");
  assert.ok(Math.abs(mv.targetCellX - 10) <= 2 && Math.abs(mv.targetCellY - 30) <= 2,
    `rides for the wire: ${JSON.stringify(mv)}`);
});

test("alarm: an EMPTY compound guards itself — no response designation", () => {
  const s = prisonWorld([{ team: 0, type: 0, cellX: 40, cellY: 40 }]);
  s.prisons[0].pows = [];
  let s2 = apply(s, { type: "join_operator", operatorId: 21, team: 0 });
  s2 = apply(s2, { type: "select_asset", operatorId: 21, assetId: 1, confirm: true });
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(21);
  const mv = ai.plan(s2).find((c) => c.type === "move_order" && c.operatorId === 21);
  if (mv) {
    assert.ok(Math.abs(mv.targetCellX - 10) > 2 || Math.abs(mv.targetCellY - 30) > 2,
      "no ride to an empty compound");
  }
});
