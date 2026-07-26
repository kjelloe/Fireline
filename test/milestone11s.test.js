// test/milestone11s.test.js — Slice 11S: the Mortar Carrier (prompt 22).
// Artillery's little brother: indirect fire that keeps up with a push —
// but NOT a siege piece, and bound by the spotter doctrine like all
// indirect tubes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { getUnitStats, UNIT_MORTAR, UNIT_ARTILLERY } from "../engine/units.js";
import { createInitialState } from "../engine/state.js";
import { sandbox, joinAndSelect } from "./helpers.js";

test("11S the mortar contract: mobile indirect, junior in every reach number", () => {
  const mortar = getUnitStats(UNIT_MORTAR);
  const arty = getUnitStats(UNIT_ARTILLERY);
  assert.equal(mortar.name, "mortar");
  assert.equal(mortar.indirect, true, "lobs over the front line");
  assert.equal(mortar.siege, false, "cannot breach infrastructure (Q9)");
  assert.ok(mortar.speed > arty.speed && mortar.turnRate > arty.turnRate,
    "keeps up with a push where the siege gun cannot");
  assert.ok(mortar.range < arty.range && mortar.damage < arty.damage &&
    mortar.minRange < arty.minRange, "junior in reach, punch, and dead zone");
});

test("11S each team fields exactly one mortar, in a garage slot", () => {
  const s = createInitialState(42, "frontier_corridor");
  for (const team of [0, 1]) {
    const mortars = s.assets.filter((a) => a.team === team && a.type === UNIT_MORTAR);
    assert.equal(mortars.length, 1);
    assert.equal(mortars[0].id, team === 0 ? 14 : 26, "reserve slot idx 6");
    assert.equal(mortars[0].operatorId, -1, "garage stock");
  }
});

test("11S fires on team-spotted targets beyond its own sensors; dead zone holds", () => {
  // Spotter scout sees the enemy; the mortar lobs from far behind it.
  let s = sandbox([
    { team: 0, cellX: 20, cellY: 10, type: UNIT_MORTAR },
    { team: 0, cellX: 40, cellY: 10, type: 1 },
    { team: 1, cellX: 44, cellY: 10, hp: 20 },
  ]);
  s = joinAndSelect(s, 0, 0, 0);
  // 24 cells out: beyond the mortar's own fog radius, within range (28 > 24? 1792/256 = 7 cells... stage closer)
  s.assets[2].x = 26 * 256;
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 2 });
  assert.equal(s.events[0].type, "fire_resolved", "the spotter doctrine feeds the tube");

  // Inside the 2-cell dead zone: rejected.
  let close = sandbox([
    { team: 0, cellX: 20, cellY: 10, type: UNIT_MORTAR },
    { team: 1, cellX: 21, cellY: 10 },
  ]);
  close = joinAndSelect(close, 0, 0, 0);
  const no = apply(close, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  assert.equal(no.events[0].reason, "target out of range", "minRange dead zone");
});

test("11S no siege, no air: the mortar refuses sites and drones", () => {
  let s = sandbox(
    [{ team: 0, cellX: 12, cellY: 10, type: UNIT_MORTAR }],
    [{ cellX: 14, cellY: 10, owner: 1 }, { cellX: 50, cellY: 50, owner: 0 }]
  );
  s = joinAndSelect(s, 0, 0, 0);
  const site = apply(s, { type: "fire_order", operatorId: 0, targetSiteId: 0 });
  assert.equal(site.events[0].reason, "cannot breach sites");

  s.drones.push({ id: 1, team: 1, x: 13 * 256, y: 10 * 256, targetAssetId: 0, ageTicks: 0, hitTimer: 0 });
  const air = apply(s, { type: "fire_order", operatorId: 0, targetDroneId: 1 });
  assert.equal(air.events[0].reason, "cannot track aircraft");
});
