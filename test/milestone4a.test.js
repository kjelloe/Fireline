// test/milestone4a.test.js — Milestone 4A: tactical UI overlay model.

import { test } from "node:test";
import assert from "node:assert/strict";
import { supplyOverlays, weaponRangeOverlay, healthBars, healthFraction } from "../client/js/overlay_model.js";
import { buildView } from "../engine/view.js";
import { createInitialState } from "../engine/state.js";
import { sandbox, joinAndSelect } from "./helpers.js";

test("4A supply overlays cover own bases and owned relays only", () => {
  const s = createInitialState(42, "frontier_corridor");
  s.sites[0].owner = 0;
  s.sites[1].owner = 1;
  const view = buildView(s, 0);
  const overlays = supplyOverlays(view);
  assert.equal(overlays.filter((o) => o.kind === "base").length, 1, "own base only");
  assert.equal(overlays.filter((o) => o.kind === "relay").length, 1, "owned relay only");
  assert.equal(overlays.find((o) => o.kind === "relay").radiusCells, 12);
});

test("4A weapon range ring follows the operated asset's chassis", () => {
  let s = sandbox([{ team: 0, cellX: 10, type: 2 }]); // artillery
  s = joinAndSelect(s, 0, 0, 0);
  const ring = weaponRangeOverlay(buildView(s, 0), 0);
  assert.equal(ring.radiusCells, 12);
  assert.equal(ring.minRadiusCells, 3);
  assert.equal(weaponRangeOverlay(buildView(s, 0), 5), null, "no ring without an asset");
});

test("4A health bars: exact fractions for friends, none for enemy wrecks", () => {
  const s = sandbox([
    { team: 0, cellX: 0, hp: 50 },              // tank at half
    { team: 1, cellX: 2 },                       // visible enemy
    { team: 1, cellX: 3, state: 2, hp: 0 },      // wreck
  ]);
  const bars = healthBars(buildView(s, 0));
  assert.equal(bars.find((b) => b.id === 0).fraction, 0.5);
  const enemyBar = bars.find((b) => b.id === 1);
  assert.equal(enemyBar.fraction, null, "enemy hp stays fogged");
  assert.equal(bars.some((b) => b.id === 2), false, "wrecks carry no bar");
  assert.equal(healthFraction({ type: 1, hp: 60 }), 1, "scout full at 60");
});
