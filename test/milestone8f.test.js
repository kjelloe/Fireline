// test/milestone8f.test.js — Milestone 8F: minimap model + standard awareness.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMinimapModel, minimapClickToCell, DOT_FRIENDLY, DOT_ENEMY, DOT_WRECK,
} from "../client/js/minimap_model.js";
import { buildView } from "../engine/view.js";
import { createInitialState } from "../engine/state.js";
import { sandbox } from "./helpers.js";

test("8F minimap mirrors the fog-filtered view exactly", () => {
  const s = sandbox([
    { team: 0, cellX: 10, cellY: 12 },
    { team: 1, cellX: 14, cellY: 12 },              // visible (within 12)
    { team: 1, cellX: 60, cellY: 60 },               // fogged
    { team: 1, cellX: 50, cellY: 50, state: 2, hp: 0 }, // wreck, always visible
  ]);
  const model = buildMinimapModel(buildView(s, 0), 64);
  const kinds = model.dots.map((d) => d.kind).sort();
  assert.deepEqual(kinds, [DOT_ENEMY, DOT_FRIENDLY, DOT_WRECK]);
  assert.equal(model.dots.some((d) => d.x === 60), false, "fogged enemy never plotted");
});

test("8F command zones, relays, and both standards always present", () => {
  const s = createInitialState(42, "frontier_corridor");
  s.sites[1].owner = 1;
  const model = buildMinimapModel(buildView(s, 0), 128);
  assert.equal(model.zones.length, 2);
  assert.equal(model.relays.length, 4); // 11C: mirrored relay pairs
  assert.equal(model.relays[1].owner, 1);
  assert.equal(model.standards.length, 2, "standard awareness is the point");
  assert.deepEqual(model.standards.map((st) => st.status), [0, 0]);
});

test("8F viewport rectangle and minimap click mapping", () => {
  const model = buildMinimapModel({}, 128, { x: 64, y: 60, halfW: 20, halfH: 12 });
  assert.deepEqual(model.viewport, { x: 44, y: 48, width: 40, height: 24 });

  assert.deepEqual(minimapClickToCell(0, 0, 160, 128), { cellX: 0, cellY: 0 });
  assert.deepEqual(minimapClickToCell(80, 40, 160, 128), { cellX: 64, cellY: 32 });
  assert.deepEqual(minimapClickToCell(159.9, 159.9, 160, 128), { cellX: 127, cellY: 127 });
});
