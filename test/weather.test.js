// test/weather.test.js — 16G weather events (gameplay-evolved #4b).
// One deterministic front per war: schedule is a PURE function of the
// map seed (mid-war band, 90 s), sensors halve inside it, both teams
// equally, and the edges announce themselves.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { weatherWindow, weatherActive, WEATHER_DURATION_TICKS } from "../engine/los.js";
import { buildView } from "../engine/view.js";
import { sandbox } from "./helpers.js";

test("16G: the schedule is deterministic, mid-war, and seed-varied", () => {
  const a = weatherWindow(42);
  assert.deepEqual(weatherWindow(42), a, "pure function of the seed");
  assert.ok(a.start >= 6000 && a.start < 12000, `mid-war band: ${a.start}`);
  assert.equal(a.end - a.start, WEATHER_DURATION_TICKS);
  assert.notEqual(weatherWindow(43).start, a.start, "seeds vary the hour");
});

test("16G: inside the front, sensors halve — a spotted enemy vanishes", () => {
  // Enemy at 8 cells: visible normally (radius 12), invisible in the
  // storm (radius 6).
  let s = sandbox([
    { team: 0, cellX: 20, cellY: 20 },
    { team: 1, cellX: 28, cellY: 20 },
  ]);
  const w = weatherWindow(s.mapSeed);
  assert.equal(buildView(s, 0).visibleEnemies.length, 1, "clear skies: spotted");
  s.tick = w.start;
  assert.ok(weatherActive(s));
  assert.equal(buildView(s, 0).visibleEnemies.length, 0, "the storm hides it");
  assert.equal(buildView(s, 1).visibleEnemies.length, 0, "both teams equally blind");
  s.tick = w.end;
  assert.equal(buildView(s, 0).visibleEnemies.length, 1, "skies clear again");
});

test("16G: the front announces itself at both edges", () => {
  let s = sandbox([
    { team: 0, cellX: 5, cellY: 5 },
    { team: 1, cellX: 60, cellY: 60 },
  ]);
  const w = weatherWindow(s.mapSeed);
  s.tick = w.start - 1;
  s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some((e) => e.type === "weather_front" && e.phase === "in"));
  s.tick = w.end - 1;
  s = apply(s, { type: "advance_tick" });
  assert.ok(s.events.some((e) => e.type === "weather_front" && e.phase === "out"));
});
