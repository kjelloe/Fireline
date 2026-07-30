// test/node_classes.test.js — B2 typed node classes (Q30 ruling:
// a) every kind still counts as a relay for majority/bleed;
// b) frontier lateral-north pair RADAR + near-base road pair DEPOT,
//    blackwood deep-woods pairs RADAR/DEPOT;
// c) default magnitudes, sweep-tested).

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, MPG_TICKS } from "../engine/reducer.js";
import { computeVisible, FOG_RADIUS_CELLS } from "../engine/los.js";
import {
  KIND_RADAR, KIND_DEPOT, KIND_FACTORY, RADAR_BONUS_CELLS, FACTORY_WAVE_DISCOUNT,
} from "../engine/sites.js";
import { createInitialState, MAP_LAYOUTS, ASSET_DISABLED } from "../engine/state.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const OFF_BASES = [
  { team: 0, x: 0, y: 0, width: 4, height: 4 },
  { team: 1, x: 60, y: 60, width: 4, height: 4 },
];

test("B2 RADAR: holding one widens every sensor on the team", () => {
  // Enemy sits FOG_RADIUS+3 away: invisible without radar, seen with it.
  const dist = FOG_RADIUS_CELLS + 3;
  assert.ok(dist <= FOG_RADIUS_CELLS + RADAR_BONUS_CELLS, "inside the bonus band");
  const base = [
    { team: 0, cellX: 10, cellY: 10 },
    { team: 1, cellX: 10 + dist, cellY: 10 },
  ];
  const blind = sandbox(base, [{ cellX: 40, cellY: 40, kind: KIND_RADAR, owner: -1 }], { bases: OFF_BASES });
  assert.ok(!computeVisible(blind, 0).has(1), "no radar, no sight");
  const seeing = sandbox(base, [{ cellX: 40, cellY: 40, kind: KIND_RADAR, owner: 0 }], { bases: OFF_BASES });
  assert.ok(computeVisible(seeing, 0).has(1), "owned radar reaches out");
  assert.ok(!computeVisible(seeing, 1).has(0), "the bonus is the OWNER'S");
});

test("B2 DEPOT: idle beside an owned depot resupplies like home", () => {
  let s = sandbox(
    [{ team: 0, cellX: 32, cellY: 30, ammo: 1, fuel: 500 }],
    [{ cellX: 30, cellY: 30, kind: KIND_DEPOT, owner: 0 }],
    { bases: OFF_BASES });
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].ammo, 12, "rearmed at the depot");
  assert.equal(s.assets[0].fuel, 4000, "refuelled at the depot");

  let far = sandbox(
    [{ team: 0, cellX: 40, cellY: 30, ammo: 1, fuel: 500 }],
    [{ cellX: 30, cellY: 30, kind: KIND_DEPOT, owner: 0 }],
    { bases: OFF_BASES });
  far = apply(far, { type: "advance_tick" });
  assert.equal(far.assets[0].ammo, 1, "10 cells away is not beside it");

  let enemy = sandbox(
    [{ team: 0, cellX: 32, cellY: 30, ammo: 1, fuel: 500 }],
    [{ cellX: 30, cellY: 30, kind: KIND_DEPOT, owner: 1 }],
    { bases: OFF_BASES });
  enemy = apply(enemy, { type: "advance_tick" });
  assert.equal(enemy.assets[0].ammo, 1, "the enemy's depot feeds nobody of ours");
});

test("B2 FACTORY: holding one shaves a flat slice off the wave; the floor holds", () => {
  const build = (factoryOwner, salvage = 0) => {
    // A counterweight site for the other team, or the single-relay
    // sandbox trap ends the war by DOMINATION at tick 300.
    let s = sandbox([
      { team: 0, cellX: 5, cellY: 5 },
      { team: 0, cellX: 20, cellY: 20, state: ASSET_DISABLED, hp: 0 },
      { team: 1, cellX: 50, cellY: 50 },
    ], [
      { cellX: 40, cellY: 40, kind: KIND_FACTORY, owner: factoryOwner },
      { cellX: 55, cellY: 55, owner: factoryOwner === 0 ? 1 : 0 },
    ],
    { bases: OFF_BASES });
    s.salvage = [salvage, 0];
    return s;
  };
  const need = MPG_TICKS - FACTORY_WAVE_DISCOUNT;
  let s = build(0);
  for (let i = 0; i < need; i++) s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some((e) => e.type === "asset_manufactured"), "factory wave early");

  let plain = build(1); // the ENEMY owns it
  for (let i = 0; i < need; i++) plain = apply(plain, { type: "advance_tick" });
  assert.ok(!plain.events.some((e) => e.type === "asset_manufactured"), "their factory, their wave");

  // Salvage 6 (600) + factory (180) would cut below the floor: 900/3 = 300.
  let fl = build(0, 6);
  for (let i = 0; i < 299; i++) fl = apply(fl, { type: "advance_tick" });
  assert.ok(!fl.events.some((e) => e.type === "asset_manufactured"), "the floor holds at 300");
  fl = apply(fl, { type: "advance_tick" });
  assert.ok(fl.events.some((e) => e.type === "asset_manufactured"), "and fires exactly there");
});

test("B2 kinds come in mirrored pairs on every layout, and still count as relays", () => {
  for (const [name, layout] of Object.entries(MAP_LAYOUTS)) {
    for (const site of layout.relayCells) {
      const kind = site.kind ?? 0;
      if (kind === 0) continue;
      const partner = layout.relayCells.find((p) =>
        p.cellX === 127 - site.cellX && p.cellY === site.cellY);
      assert.ok(partner, `${name}: (${site.cellX},${site.cellY}) has a mirror partner`);
      assert.equal(partner.kind ?? 0, kind, `${name}: the partner shares the kind`);
    }
  }
  // Ruling (a): typed sites keep type=SITE_RELAY — the majority math is untouched.
  const s = createInitialState(42, "frontier_corridor");
  assert.ok(s.sites.every((x) => x.type === 1), "every site is still a relay");
  assert.ok(s.sites.some((x) => x.kind === KIND_RADAR), "frontier has its radar pair");
  assert.ok(s.sites.some((x) => x.kind === KIND_DEPOT), "and its depot pair");
});
