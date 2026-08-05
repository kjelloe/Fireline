// client/js/tutorial_model.js — W4-12: the tutorial quest-line, as a
// PURE state controller (the splash_model precedent). The DOM layer in
// client.js renders phases and feeds observations in; every rule the
// design cares about is node-testable here:
//
// - INTRO ("looks like it's your first time") -> TOUR (arrows over the
//   real HUD elements) -> QUESTS (a sequential ladder of real actions)
//   -> DONE. SKIP TUTORIAL exits from any phase.
// - Quest completion is detected from what the player actually DID:
//   commands they sent, UI actions they took, and events on their own
//   fog-filtered view. Nothing here can see past the fog because it is
//   only ever fed the per-team view — fog-legit by construction.
// - State-dependent quests (a tow needs a wreck to exist) carry a
//   per-step skip so the ladder can never dead-end.
// - Completing OR skipping is a terminal decision the DOM persists
//   (mf_tutorial); a skip falls back to the old four-beat coach.

export const PHASE_OFF = 0;
export const PHASE_INTRO = 1;
export const PHASE_TOUR = 2;
export const PHASE_QUESTS = 3;
export const PHASE_DONE = 4;

// Every targetId must exist in client/index.html — a lint reads this
// list against the page so a renamed element cannot leave an arrow
// pointing at nothing (the view-contract lesson, applied up front).
export const TOUR_STOPS = Object.freeze([
  { targetId: "op-info", textKey: "tut.tour.op", side: "below" },
  { targetId: "objective-strip", textKey: "tut.tour.objective", side: "below" },
  { targetId: "task-strip", textKey: "tut.tour.tasks", side: "left" },
  { targetId: "team-board", textKey: "tut.tour.team", side: "right" },
  { targetId: "minimap", textKey: "tut.tour.minimap", side: "above" },
  { targetId: "supply-bar", textKey: "tut.tour.supply", side: "above" },
  { targetId: "hint-bar", textKey: "tut.tour.hints", side: "above" },
]);

const SPECIAL_COMMANDS = new Set([
  "deploy_mine", "deploy_caltrops", "build_sandbag", "deploy_smoke",
  "deploy_hardpoint", "clear_mine",
]);

const CAPTURE_NEAR_CELLS = 5;

// The ladder. Ordered so the always-available basics come first and the
// world-state-dependent quests (wreck, carrier) come once the war has
// produced them. Matchers see only what the DOM feeds in:
//   matchCommand(cmd)        — a command this player sent
//   matchUi(action)          — a client-side action (camera, buttons)
//   matchEvent(evt, ctx)     — an event on the player's own view, with
//                              ctx = { team, myAssetId, myPos, sites }
export const QUESTS = Object.freeze([
  { id: "move", textKey: "tut.q.move",
    matchCommand: (c) => c.type === "move_order" && c.queue !== true },
  { id: "waypoint", textKey: "tut.q.waypoint",
    matchCommand: (c) => c.type === "move_order" && c.queue === true },
  { id: "camera", textKey: "tut.q.camera",
    matchUi: (a) => a === "follow" || a === "recenter" },
  { id: "ping", textKey: "tut.q.ping",
    matchCommand: (c) => c.type === "ping" },
  { id: "fire", textKey: "tut.q.fire",
    matchCommand: (c) => c.type === "fire_order" && c.smoke !== true },
  { id: "capture", textKey: "tut.q.capture",
    matchEvent: (e, ctx) => {
      if (e.type !== "site_captured" || e.team !== ctx.team) return false;
      const site = (ctx.sites ?? []).find((s) => s.id === e.siteId);
      if (!site || !ctx.myPos) return false;
      const d = Math.max(Math.abs(site.cellX - ctx.myPos.cx), Math.abs(site.cellY - ctx.myPos.cy));
      return d <= CAPTURE_NEAR_CELLS;
    } },
  { id: "switch", textKey: "tut.q.switch",
    matchUi: (a) => a === "next-asset",
    matchCommand: (c) => c.type === "select_asset" },
  { id: "tow", textKey: "tut.q.tow",
    matchEvent: (e, ctx) => e.type === "tow_started" && e.by === ctx.myAssetId },
  { id: "board", textKey: "tut.q.board",
    matchCommand: (c) => c.type === "board_carrier" || c.type === "redeploy" },
  { id: "special", textKey: "tut.q.special",
    matchCommand: (c) => SPECIAL_COMMANDS.has(c.type) },
  { id: "direct", textKey: "tut.q.direct",
    matchUi: (a) => a === "direct" },
  { id: "win", textKey: "tut.q.win",
    matchUi: (a) => a === "acknowledge" },
]);

export function createTutorial() {
  const s = {
    phase: PHASE_OFF,
    tour: 0,          // index into TOUR_STOPS
    quest: 0,         // index into QUESTS
    results: {},      // quest id -> "done" | "skipped"
    skippedAll: false,
    justCompleted: null, // quest id, consumed by the DOM for the ✓ flash
  };

  function advanceQuest() {
    s.quest += 1;
    if (s.quest >= QUESTS.length) s.phase = PHASE_DONE;
  }

  function complete() {
    const q = QUESTS[s.quest];
    s.results[q.id] = "done";
    s.justCompleted = q.id;
    advanceQuest();
  }

  return {
    state: s,
    arm() { if (s.phase === PHASE_OFF) s.phase = PHASE_INTRO; },
    startTour() { if (s.phase === PHASE_INTRO) { s.phase = PHASE_TOUR; s.tour = 0; } },
    nextTour() {
      if (s.phase !== PHASE_TOUR) return;
      s.tour += 1;
      if (s.tour >= TOUR_STOPS.length) s.phase = PHASE_QUESTS;
    },
    skipAll() {
      if (s.phase === PHASE_DONE || s.phase === PHASE_OFF) return;
      s.skippedAll = true;
      s.phase = PHASE_DONE;
    },
    skipStep() {
      if (s.phase !== PHASE_QUESTS) return;
      s.results[QUESTS[s.quest].id] = "skipped";
      advanceQuest();
    },
    noteCommand(cmd) {
      if (s.phase !== PHASE_QUESTS || !cmd) return;
      const q = QUESTS[s.quest];
      if (q.matchCommand?.(cmd)) complete();
    },
    noteUi(action) {
      if (s.phase !== PHASE_QUESTS) return;
      const q = QUESTS[s.quest];
      if (q.matchUi?.(action)) complete();
    },
    noteEvents(events, ctx) {
      if (s.phase !== PHASE_QUESTS || !Array.isArray(events)) return;
      const q = QUESTS[s.quest];
      if (!q.matchEvent) return;
      for (const e of events) {
        if (q.matchEvent(e, ctx ?? {})) { complete(); return; }
      }
    },
    consumeCompleted() {
      const id = s.justCompleted;
      s.justCompleted = null;
      return id;
    },
    currentStop() { return s.phase === PHASE_TOUR ? TOUR_STOPS[s.tour] : null; },
    currentQuest() { return s.phase === PHASE_QUESTS ? QUESTS[s.quest] : null; },
    finishedClean() { return s.phase === PHASE_DONE && !s.skippedAll; },
  };
}
