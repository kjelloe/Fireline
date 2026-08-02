// test/fog_model.test.js — prompt 147: the fog sheen's edge IS the
// spotting edge. The mask replicates engine/los.js: 12-cell chebyshev
// squares per hull (6 suppressed), 16 per owned site, storm halves,
// radar +6, spectators see all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fogMask } from "../client/js/fog_model.js";
import { weatherWindow } from "../engine/los.js";

const at = (m, x, y, w = 128) => m[y * w + x];
const cellToWorld = (c) => c * 256 + 128;

test("fog: a lone hull lights exactly its 12-cell chebyshev square", () => {
  const view = {
    friendlyAssets: [{ team: 0, state: 0, x: cellToWorld(60), y: cellToWorld(60), suppressedTimer: 0 }],
    sites: [],
  };
  const m = fogMask(view, 0, 7, 0, 128, 128);
  assert.equal(at(m, 60, 60), 1);
  assert.equal(at(m, 72, 60), 1, "edge of the square is lit");
  assert.equal(at(m, 73, 60), 0, "one past the edge is fog");
  assert.equal(at(m, 72, 72), 1, "chebyshev corner lit (squares, honestly)");
  assert.equal(at(m, 73, 73), 0);
});

test("fog: an owned relay lights 16; enemy relays light nothing", () => {
  const view = { friendlyAssets: [], sites: [
    { owner: 0, kind: 0, cellX: 30, cellY: 30 },
    { owner: 1, kind: 0, cellX: 90, cellY: 90 },
  ] };
  const m = fogMask(view, 0, 7, 0, 128, 128);
  assert.equal(at(m, 46, 30), 1);
  assert.equal(at(m, 47, 30), 0);
  assert.equal(at(m, 90, 90), 0, "the enemy relay lights nothing for us");
});

test("fog: the storm halves the square; wrecks light nothing; spectators see all", () => {
  const w = weatherWindow(7);
  const view = {
    friendlyAssets: [
      { team: 0, state: 0, x: cellToWorld(60), y: cellToWorld(60), suppressedTimer: 0 },
      { team: 0, state: 2, x: cellToWorld(10), y: cellToWorld(10), suppressedTimer: 0 },
    ],
    sites: [],
  };
  const m = fogMask(view, 0, 7, w.start, 128, 128);
  assert.equal(at(m, 66, 60), 1, "storm: 6-cell edge lit");
  assert.equal(at(m, 67, 60), 0, "storm: 7 is fog");
  assert.equal(at(m, 10, 10), 0, "a wreck is not a sensor");
  const spec = fogMask(view, -1, 7, 0, 128, 128);
  assert.equal(at(spec, 0, 0), 1, "spectators see everything");
});

test("160.2: the compound watches itself — base rect always lit, engine and fog agree", async () => {
  const { computeVisible } = await import("../engine/los.js");
  const { cellToWorld } = await import("../shared/fixedmath.js");
  const state = {
    assets: [
      { id: 0, team: 0, state: 0, x: cellToWorld(60), y: cellToWorld(60), suppressedTimer: 0 },
      { id: 1, team: 1, state: 0, x: cellToWorld(10), y: cellToWorld(60), suppressedTimer: 0 },
    ],
    sites: [], bases: [{ team: 0, x: 6, y: 54, width: 18, height: 20 }],
    mapSeed: 7, tick: 0,
  };
  assert.ok(computeVisible(state, 0).has(1), "intruder in the compound is seen from anywhere");
  const fogView = { friendlyAssets: [], sites: [], bases: state.bases };
  const m = fogMask(fogView, 0, 7, 0, 128, 128);
  assert.equal(m[60 * 128 + 10], 1, "fog model lights the compound");
  assert.equal(m[60 * 128 + 40], 0, "outside stays fog");
});
