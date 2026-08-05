// test/night_war.test.js — W4-10 (Q80 ruling): NIGHT WARS. A night war
// is a storm that never lifts. The 16G sensor law is already exactly
// right for darkness — halve every sensor so scouts, pings and standard
// runs matter more — so night reuses it wholesale rather than inventing
// a second dimming system that would need its own fairness proof.
// Pure function of rules + tick: nothing new is hashed, replays are
// untouched, and the sensor change is symmetric by construction.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeVisible, weatherActive } from "../engine/los.js";
import { sandbox, joinAndSelect } from "./helpers.js";

function nightWorld(night) {
  // A tank (sensor 12) and an enemy at 8 cells: inside by day, outside
  // once the sensor halves.
  const s = sandbox([
    { team: 0, type: 0, cellX: 20, cellY: 20 },
    { team: 1, type: 0, cellX: 28, cellY: 20 },
  ], [], {
    bases: [
      { team: 0, x: 0, y: 0, width: 4, height: 4 },
      { team: 1, x: 60, y: 60, width: 4, height: 4 },
    ],
  });
  if (night) s.rules = { ...s.rules, nightWar: true };
  return joinAndSelect(s, 0, 0, 0);
}

test("W4-10: by day the enemy at 8 cells is seen", () => {
  assert.ok(computeVisible(nightWorld(false), 0).has(1));
});

test("W4-10: at night the same enemy is dark — sensors halve", () => {
  assert.ok(!computeVisible(nightWorld(true), 0).has(1));
});

test("W4-10: night is a storm that NEVER lifts", () => {
  const s = nightWorld(true);
  assert.equal(weatherActive({ ...s, tick: 0 }), true, "dark at tick 0");
  assert.equal(weatherActive({ ...s, tick: 50000 }), true, "still dark late");
  const day = nightWorld(false);
  assert.equal(weatherActive({ ...day, tick: 0 }), false, "a normal war starts clear");
});

test("W4-10: night is symmetric — it dims both sides identically", () => {
  // The fairness argument in one assertion: the rule keys on nothing
  // team-specific, so a mirrored pair must read identically.
  const s = nightWorld(true);
  const flipped = { ...s, assets: s.assets.map((a) => ({ ...a, team: a.team === 0 ? 1 : 0 })) };
  assert.equal(computeVisible(s, 0).has(1), computeVisible(flipped, 1).has(1));
});

test("W4-10: nothing about night is hashed", async () => {
  const { hashState } = await import("../engine/snapshot.js");
  const day = nightWorld(false);
  const night = nightWorld(true);
  // rules are not hashed state; the two wars are byte-identical.
  assert.equal(hashState(night), hashState(day),
    "night changes what you can SEE, never the war's recorded state");
});
