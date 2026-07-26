// test/milestone11f.test.js — Slice 11F: damaged sites + materiel
// (prompt 16 Q9). Artillery breaches relays; a damaged site keeps its
// owner but projects nothing and cannot flip; trucks load one materiel in
// base and rebuild adjacent damaged sites. Bases stay sacred (Q19 default).

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { SITE_HP_MAX, SITE_CAPTURE_TICKS } from "../engine/sites.js";
import { AIRegency } from "../engine/ai_regency.js";
import { inSupply } from "../engine/supply.js";
import { buildView } from "../engine/view.js";
import { hashState } from "../engine/snapshot.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const OFF_BASES = [
  { team: 0, x: 0, y: 60, width: 4, height: 4 },
  { team: 1, x: 60, y: 60, width: 4, height: 4 },
];

// Artillery (range 3072 = 12 cells) parked 8 cells from an enemy relay.
function siegeState(siteSpec = { cellX: 20, cellY: 10, owner: 1 }) {
  let s = sandbox(
    [{ team: 0, cellX: 12, cellY: 10, type: 2 }],
    [siteSpec, { cellX: 50, cellY: 50, owner: 0 }]
  );
  return joinAndSelect(s, 0, 0, 0);
}

test("11F artillery breaches a relay in two shells; direct guns cannot", () => {
  let s = siegeState();
  s = apply(s, { type: "fire_order", operatorId: 0, targetSiteId: 0 });
  assert.deepEqual(
    s.events.find((e) => e.type === "site_shelled"),
    { type: "site_shelled", siteId: 0, byAssetId: 0, siteHp: SITE_HP_MAX - 30 }
  );
  assert.ok(s.assets[0].reloadTimer > 0, "a real shot");

  s.assets[0].reloadTimer = 0;
  s = apply(s, { type: "fire_order", operatorId: 0, targetSiteId: 0 });
  assert.ok(s.events.some((e) => e.type === "site_damaged"));
  assert.equal(s.sites[0].hp, 0);
  assert.equal(s.sites[0].owner, 1, "ruins keep their flag");

  const again = apply(s, { type: "fire_order", operatorId: 0, targetSiteId: 0 });
  assert.equal(again.events[0].reason, "site already damaged");

  let tank = sandbox([{ team: 0, cellX: 12, cellY: 10 }], [{ cellX: 14, cellY: 10 }]);
  tank = joinAndSelect(tank, 0, 0, 0);
  const no = apply(tank, { type: "fire_order", operatorId: 0, targetSiteId: 0 });
  assert.equal(no.events[0].reason, "cannot breach sites");
});

test("11F a damaged site projects no supply or fog and cannot flip", () => {
  // Supply: a unit sitting beside its team's damaged relay is dry.
  let s = sandbox(
    [{ team: 0, cellX: 30, cellY: 30 }],
    [{ cellX: 31, cellY: 30, owner: 0, hp: 0 }],
    { bases: OFF_BASES }
  );
  assert.equal(inSupply(s, s.assets[0]), false, "ruins pump nothing");

  // Fog: the damaged relay reveals nothing.
  const spy = sandbox(
    [{ team: 0, cellX: 1, cellY: 1 }, { team: 1, cellX: 33, cellY: 30 }],
    [{ cellX: 31, cellY: 30, owner: 0, hp: 0 }],
    { bases: OFF_BASES }
  );
  assert.equal(buildView(spy, 0).visibleEnemies.length, 0);

  // Capture: standing on ruins flips nothing, ever.
  let flip = sandbox(
    [{ team: 0, cellX: 31, cellY: 30 }],
    [{ cellX: 31, cellY: 30, owner: 1, hp: 0 }, { cellX: 50, cellY: 50, owner: 0 }],
    { bases: OFF_BASES }
  );
  for (let i = 0; i < SITE_CAPTURE_TICKS * 4; i++) flip = apply(flip, { type: "advance_tick" });
  assert.equal(flip.sites[0].owner, 1, "dead ground cannot be taken");
  assert.equal(flip.sites[0].captureProgress, 0);
});

test("11F trucks load materiel in base and rebuild adjacent ruins", () => {
  let s = sandbox(
    [{ team: 0, cellX: 1, cellY: 61, type: 3 }],
    [{ cellX: 20, cellY: 20, owner: 0, hp: 0 }],
    { bases: OFF_BASES }
  );
  assert.equal(s.assets[0].materiel, 0);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].materiel, 1, "loaded at home, silently");

  // Carry it to the ruin: park beside it.
  s.assets[0].x = 21 * 256;
  s.assets[0].y = 20 * 256;
  s = apply(s, { type: "advance_tick" });
  const fixed = s.events.find((e) => e.type === "site_repaired");
  assert.deepEqual(fixed, { type: "site_repaired", siteId: 0, byAssetId: 0 });
  assert.equal(s.sites[0].hp, SITE_HP_MAX);
  assert.equal(s.assets[0].materiel, 0, "the crate is spent");

  // Tanks never load.
  let tank = sandbox([{ team: 0, cellX: 1, cellY: 61 }], [], { bases: OFF_BASES });
  tank = apply(tank, { type: "advance_tick" });
  assert.equal(tank.assets[0].materiel, 0);
});

test("11F enemy ruins are not ours to fix", () => {
  let s = sandbox(
    [{ team: 0, cellX: 21, cellY: 20, type: 3, materiel: 1 }],
    [{ cellX: 20, cellY: 20, owner: 1, hp: 0 }],
    { bases: OFF_BASES }
  );
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.sites[0].hp, 0, "their ruin stays theirs to mourn");
  assert.equal(s.assets[0].materiel, 1);
});

test("11F the AI truck runs a repair errand", () => {
  let s = sandbox(
    [{ team: 0, cellX: 30, cellY: 30, type: 3, materiel: 1 }],
    [{ cellX: 40, cellY: 30, owner: 0, hp: 0 }, { cellX: 50, cellY: 50, owner: 0 }],
    { bases: OFF_BASES }
  );
  s = joinAndSelect(s, 0, 0, 0);
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(0);
  const move = ai.plan(s).find((c) => c.type === "move_order");
  assert.deepEqual({ x: move?.targetCellX, y: move?.targetCellY }, { x: 40, y: 31 },
    "parks beside the ruin; the materiel pass does the rest");
});

test("11F site hp and truck materiel are hashed", () => {
  const a = sandbox([{ team: 0, cellX: 1, type: 3 }], [{ cellX: 20 }]);
  const b = sandbox([{ team: 0, cellX: 1, type: 3 }], [{ cellX: 20 }]);
  b.sites[0].hp = 30;
  assert.notEqual(hashState(a), hashState(b));
  const c = sandbox([{ team: 0, cellX: 1, type: 3 }], [{ cellX: 20 }]);
  c.assets[0].materiel = 1;
  assert.notEqual(hashState(a), hashState(c));
});
