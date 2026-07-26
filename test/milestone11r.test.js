// test/milestone11r.test.js — Slice 11R: the Scout Bike (prompt 22).
// Outruns everything, dies to anything, and can neither capture nor
// contest a relay. Also pins the new siege flag: only artillery breaches.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { getUnitStats, UNIT_BIKE, UNIT_STATS } from "../engine/units.js";
import { SITE_CAPTURE_TICKS, SITE_NEUTRALIZE_TICKS } from "../engine/sites.js";
import { createInitialState } from "../engine/state.js";
import { sandbox, joinAndSelect } from "./helpers.js";

test("11R the bike contract: fastest thing on wheels, no flag hands", () => {
  const bike = getUnitStats(UNIT_BIKE);
  assert.equal(bike.name, "bike");
  assert.equal(bike.canCapture, false, "cannot capture");
  assert.equal(bike.canCarryStandard, false);
  assert.equal(bike.heavy, false, "trails are its home");
  for (const [type, stats] of Object.entries(UNIT_STATS)) {
    if (Number(type) === UNIT_BIKE) continue;
    assert.ok(bike.speed > stats.speed, `outruns chassis ${type}`);
    assert.equal(stats.canCapture, true, `chassis ${type} still captures`);
  }
  assert.equal(
    Object.values(UNIT_STATS).filter((s) => s.siege).length, 1,
    "exactly one siege chassis"
  );
  assert.equal(getUnitStats(2).siege, true, "and it is the artillery");
});

test("11R each team fields exactly one bike, in a garage slot", () => {
  const s = createInitialState(42, "frontier_corridor");
  for (const team of [0, 1]) {
    const bikes = s.assets.filter((a) => a.team === team && a.type === UNIT_BIKE);
    assert.equal(bikes.length, 1);
    assert.equal(bikes[0].operatorId, -1, "garage stock, not AI-paired");
    assert.equal(bikes[0].id, team === 0 ? 12 : 24, "reserve slot idx 4");
  }
});

test("11R a bike on a flag neither captures nor contests it", () => {
  // Alone on a neutral relay forever: nothing happens.
  let s = sandbox(
    [{ team: 0, cellX: 5, type: UNIT_BIKE }],
    [{ cellX: 5 }, { cellX: 60, owner: 1 }]
  );
  for (let i = 0; i < SITE_CAPTURE_TICKS * 3; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.sites[0].owner, -1, "no capture");
  assert.equal(s.sites[0].captureProgress, 0);

  // Standing on an enemy's flag while THEY capture: no contest freeze.
  let contest = sandbox(
    [{ team: 0, cellX: 5, type: UNIT_BIKE }, { team: 1, cellX: 5 }],
    [{ cellX: 5 }, { cellX: 60, owner: 0 }]
  );
  for (let i = 0; i <= SITE_CAPTURE_TICKS; i++) contest = apply(contest, { type: "advance_tick" });
  assert.equal(contest.sites[0].owner, 1, "the tank takes it right past the bike");
});

test("11R the bike still returns its own standard (any chassis may)", () => {
  let s = sandbox(
    [{ team: 0, cellX: 10, type: UNIT_BIKE }],
    [],
    {
      bases: [{ team: 0, x: 0, y: 60, width: 4, height: 4 }],
      standards: [{ team: 0, cellX: 10, status: 2 /* DROPPED */ }, { team: 1, cellX: 60 }],
    }
  );
  s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some((e) => e.type === "standard_returned"),
    "the courier role: fastest standard-recovery in the war");
});

test("11R mortars-to-be: indirect no longer implies siege (mortar prep)", () => {
  // A non-siege indirect chassis must be rejected at the breach. Simulate
  // by asking artillery (siege) vs a scout (neither): the reject reason is
  // the siege flag's, not the old indirect gate's.
  let s = sandbox(
    [{ team: 0, cellX: 12, cellY: 10 }],
    [{ cellX: 14, cellY: 10, owner: 1 }, { cellX: 50, cellY: 50, owner: 0 }]
  );
  s = joinAndSelect(s, 0, 0, 0);
  const no = apply(s, { type: "fire_order", operatorId: 0, targetSiteId: 0 });
  assert.equal(no.events[0].reason, "cannot breach sites");
});
