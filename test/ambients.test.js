// test/ambients.test.js — figure-kit r2 ambient NPCs (pure model, the
// 16G precedent: f(seed, tick, terrain), nothing hashed, viewer-local
// reactions only).

import { test } from "node:test";
import assert from "node:assert/strict";
import { ambientAnchors, ambientFigures } from "../client/js/ambients_model.js";
import { createInitialState } from "../engine/state.js";

test("ambients: anchors are deterministic per map and civilian-shaped", () => {
  const s = createInitialState(42, "frontier_corridor");
  const a1 = ambientAnchors(s.map.cells, s.map.width, s.map.height, 42);
  const a2 = ambientAnchors(s.map.cells, s.map.width, s.map.height, 42);
  assert.deepEqual(a1, a2, "pure function of (terrain, seed)");
  assert.ok(a1.some((a) => a.kind === "farmhand"), "farmhands exist");
  assert.ok(a1.some((a) => a.kind === "roadworker"), "road workers exist");
  assert.equal(a1.filter((a) => a.kind === "trader").length, 1, "one trader cart");
  const b = ambientAnchors(s.map.cells, s.map.width, s.map.height, 43);
  assert.notDeepEqual(a1, b, "seed varies the population");
});

test("ambients: figures wander deterministically and FLEE visible war machines", () => {
  const s = createInitialState(42, "frontier_corridor");
  const anchors = ambientAnchors(s.map.cells, s.map.width, s.map.height, 42);
  const calm = ambientFigures(anchors, 1000, []);
  const calm2 = ambientFigures(anchors, 1000, []);
  assert.deepEqual(calm, calm2, "pure at a tick");
  assert.ok(calm.every((f) => !f.fleeing), "nobody panics in an empty field");
  const farm = anchors.find((a) => a.kind === "farmhand");
  const tank = { x: farm.cx * 256 + 128, y: farm.cy * 256 + 128 };
  const spooked = ambientFigures(anchors, 1000, [tank]);
  const me = spooked.find((f, i) => calm[i].kind === "farmhand" && f.fleeing);
  assert.ok(me, "a tank in the yard clears the yard");
  assert.equal(me.pose, "run");
  // Fleeing moves AWAY from the threat relative to the calm position.
  const calmMe = calm[spooked.indexOf(me)];
  const dCalm = Math.hypot(calmMe.x - tank.x / 256, calmMe.y - tank.y / 256);
  const dFlee = Math.hypot(me.x - tank.x / 256, me.y - tank.y / 256);
  assert.ok(dFlee >= dCalm, "runs away, never toward");
});
