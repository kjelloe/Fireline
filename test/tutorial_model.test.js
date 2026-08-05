// test/tutorial_model.test.js — W4-12: the tutorial quest-line
// controller, plus its two lints. The lints run FIRST by design (the
// recorded preference: lints before gates) — a tour arrow aimed at a
// renamed element or a quest string missing from a locale fails silently
// in the browser and loudly here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createTutorial, TOUR_STOPS, QUESTS,
  PHASE_OFF, PHASE_INTRO, PHASE_TOUR, PHASE_QUESTS, PHASE_DONE,
} from "../client/js/tutorial_model.js";
import { CATALOGS } from "../client/js/strings.js";

// ── lints ────────────────────────────────────────────────────────────

test("lint: every tour targetId exists in index.html", () => {
  const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  for (const stop of TOUR_STOPS) {
    assert.ok(ids.has(stop.targetId),
      `tour stop points at #${stop.targetId} which is not in index.html — ` +
      "an arrow at nothing fails silently in the browser");
  }
});

test("lint: every tutorial string key exists in BOTH locales", () => {
  const keys = [
    ...TOUR_STOPS.map((s) => s.textKey),
    ...QUESTS.map((q) => q.textKey),
    ...QUESTS.map((q) => `tut.q.${q.id}`), // the ✓ flash builds this form
    "tut.intro.title", "tut.intro.body", "tut.intro.start", "tut.skip",
    "tut.next", "tut.q.title", "tut.q.skipstep", "tut.q.gotit",
    "tut.done", "tut.replay",
  ];
  for (const locale of ["en", "no"]) {
    for (const k of keys) {
      assert.ok(k in CATALOGS[locale], `${locale} catalogue is missing "${k}"`);
    }
  }
});

// ── phase flow ───────────────────────────────────────────────────────

test("arm -> tour -> quests -> done, clean completion", () => {
  const tut = createTutorial();
  assert.equal(tut.state.phase, PHASE_OFF);
  tut.arm();
  assert.equal(tut.state.phase, PHASE_INTRO);
  tut.startTour();
  assert.equal(tut.state.phase, PHASE_TOUR);
  for (let i = 0; i < TOUR_STOPS.length; i++) {
    assert.equal(tut.currentStop(), TOUR_STOPS[i]);
    tut.nextTour();
  }
  assert.equal(tut.state.phase, PHASE_QUESTS);

  const drive = {
    move: () => tut.noteCommand({ type: "move_order" }),
    waypoint: () => tut.noteCommand({ type: "move_order", queue: true }),
    camera: () => tut.noteUi("follow"),
    ping: () => tut.noteCommand({ type: "ping", kind: 1 }),
    fire: () => tut.noteCommand({ type: "fire_order", targetAssetId: 9 }),
    capture: () => tut.noteEvents(
      [{ type: "site_captured", siteId: 3, team: 0 }],
      { team: 0, myPos: { cx: 10, cy: 10 }, sites: [{ id: 3, cellX: 12, cellY: 11 }] }),
    switch: () => tut.noteUi("next-asset"),
    tow: () => tut.noteEvents([{ type: "tow_started", assetId: 4, by: 7 }],
      { team: 0, myAssetId: 7 }),
    board: () => tut.noteCommand({ type: "redeploy" }),
    special: () => tut.noteCommand({ type: "deploy_smoke", cellX: 1, cellY: 1 }),
    direct: () => tut.noteUi("direct"),
    win: () => tut.noteUi("acknowledge"),
  };
  for (const q of QUESTS) {
    assert.equal(tut.currentQuest()?.id, q.id);
    drive[q.id]();
    assert.equal(tut.consumeCompleted(), q.id);
    assert.equal(tut.state.results[q.id], "done");
  }
  assert.equal(tut.state.phase, PHASE_DONE);
  assert.ok(tut.finishedClean());
});

test("every quest is drivable (the drive table covers the ladder)", () => {
  // If a quest is added without extending the flow test above, this
  // names it instead of the flow test dying mid-ladder.
  const covered = new Set(["move", "waypoint", "camera", "ping", "fire",
    "capture", "switch", "tow", "board", "special", "direct", "win"]);
  for (const q of QUESTS) assert.ok(covered.has(q.id), `quest ${q.id} has no test drive`);
  assert.equal(QUESTS.length, covered.size);
});

test("skipAll exits from any phase and is terminal-dirty", () => {
  for (const setup of [
    (t2) => t2.arm(),
    (t2) => { t2.arm(); t2.startTour(); },
    (t2) => { t2.arm(); t2.startTour(); for (const _ of TOUR_STOPS) t2.nextTour(); },
  ]) {
    const tut = createTutorial();
    setup(tut);
    tut.skipAll();
    assert.equal(tut.state.phase, PHASE_DONE);
    assert.equal(tut.finishedClean(), false);
  }
});

test("skipStep marks skipped and a fully-skipped ladder still ends", () => {
  const tut = createTutorial();
  tut.arm(); tut.startTour();
  for (const _ of TOUR_STOPS) tut.nextTour();
  for (const q of QUESTS) {
    assert.equal(tut.currentQuest()?.id, q.id);
    tut.skipStep();
    assert.equal(tut.state.results[q.id], "skipped");
  }
  assert.equal(tut.state.phase, PHASE_DONE);
  assert.ok(tut.finishedClean(), "per-step skips are not skipAll");
});

// ── matcher precision ────────────────────────────────────────────────

function atQuest(id) {
  const tut = createTutorial();
  tut.arm(); tut.startTour();
  for (const _ of TOUR_STOPS) tut.nextTour();
  while (tut.currentQuest() && tut.currentQuest().id !== id) tut.skipStep();
  assert.equal(tut.currentQuest()?.id, id);
  return tut;
}

test("move ignores waypoint legs; waypoint requires queue", () => {
  const tut = atQuest("move");
  tut.noteCommand({ type: "move_order", queue: true });
  assert.equal(tut.currentQuest().id, "move");
  tut.noteCommand({ type: "move_order" });
  assert.equal(tut.consumeCompleted(), "move");
  assert.equal(tut.currentQuest().id, "waypoint");
  tut.noteCommand({ type: "move_order" });
  assert.equal(tut.currentQuest().id, "waypoint");
  tut.noteCommand({ type: "move_order", queue: true });
  assert.equal(tut.consumeCompleted(), "waypoint");
});

test("fire ignores smoke rounds", () => {
  const tut = atQuest("fire");
  tut.noteCommand({ type: "fire_order", smoke: true, targetCellX: 5, targetCellY: 5 });
  assert.equal(tut.currentQuest().id, "fire");
  tut.noteCommand({ type: "fire_order", targetAssetId: 3 });
  assert.equal(tut.consumeCompleted(), "fire");
});

test("capture requires OWN team's flip with the player nearby", () => {
  const flip = (ctx) => {
    const tut = atQuest("capture");
    tut.noteEvents([{ type: "site_captured", siteId: 3, team: 0 }], ctx);
    return tut.currentQuest()?.id !== "capture";
  };
  const site = { id: 3, cellX: 12, cellY: 11 };
  assert.ok(flip({ team: 0, myPos: { cx: 10, cy: 10 }, sites: [site] }), "near own flip counts");
  assert.ok(!flip({ team: 1, myPos: { cx: 10, cy: 10 }, sites: [site] }), "enemy flip does not");
  assert.ok(!flip({ team: 0, myPos: { cx: 40, cy: 40 }, sites: [site] }), "a distant flip does not");
  assert.ok(!flip({ team: 0, myPos: null, sites: [site] }), "no position, no credit");
});

test("tow requires MY hull on the hook", () => {
  const tut = atQuest("tow");
  tut.noteEvents([{ type: "tow_started", assetId: 4, by: 9 }], { team: 0, myAssetId: 7 });
  assert.equal(tut.currentQuest().id, "tow");
  tut.noteEvents([{ type: "tow_started", assetId: 4, by: 7 }], { team: 0, myAssetId: 7 });
  assert.equal(tut.consumeCompleted(), "tow");
});

test("notes outside the quest phase are ignored", () => {
  const tut = createTutorial();
  tut.arm(); // INTRO
  tut.noteCommand({ type: "move_order" });
  tut.noteUi("follow");
  tut.noteEvents([{ type: "site_captured", siteId: 1, team: 0 }], { team: 0 });
  assert.equal(tut.state.phase, PHASE_INTRO);
  assert.equal(tut.consumeCompleted(), null);
});

test("only the CURRENT quest's matcher listens", () => {
  const tut = atQuest("move"); // quest 1 — an event for the capture quest arrives now
  tut.noteEvents(
    [{ type: "site_captured", siteId: 3, team: 0 }],
    { team: 0, myPos: { cx: 12, cy: 11 }, sites: [{ id: 3, cellX: 12, cellY: 11 }] });
  assert.equal(tut.currentQuest().id, "move", "ladder is sequential, not a checklist");
});

test("consumeCompleted yields once", () => {
  const tut = atQuest("ping");
  tut.noteCommand({ type: "ping", kind: 2 });
  assert.equal(tut.consumeCompleted(), "ping");
  assert.equal(tut.consumeCompleted(), null);
});
