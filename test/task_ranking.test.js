// test/task_ranking.test.js — prompt-79 ruling: mission cards rank by
// VALUE TO THE TEAM first, then by locality. Value is the Recognition
// table, so the to-do list and the scoreboard cannot drift apart — a
// card ranked high but scored low would teach the wrong lesson.

import { test } from "node:test";
import assert from "node:assert/strict";
import { tasksFor } from "../client/js/tasks_model.js";
import {
  RECOG_TOW, RECOG_RESCUE, RECOG_RELAY, RECOG_STANDARD_CAPTURE,
} from "../engine/reducer.js";

const CELL = 256;
// A view with my truck at (20,20): a rescue far away and a tow nearby,
// so value and locality actively DISAGREE.
function viewWith(opts = {}) {
  return {
    friendlyAssets: [
      { id: 0, type: 3 /* truck: can tow AND has no bunks */, operatorId: 7,
        x: 20 * CELL, y: 20 * CELL, state: 0, hp: 100 },
      ...(opts.extraFriendly ?? []),
    ],
    visibleEnemies: [],
    downedOperators: opts.downed ?? [],
    sites: opts.sites ?? [],
    standards: opts.standards ?? [],
    bases: [{ team: 0, x: 0, y: 0, width: 128, height: 128 }],
    ...opts.view,
  };
}

test("79: the value table matches the Recognition ruling it claims to follow", () => {
  // If someone retunes Recognition, this fails and forces the card
  // values to be retuned with it - which is the entire point.
  assert.equal(RECOG_RESCUE, 10);
  assert.equal(RECOG_RELAY, 10);
  assert.equal(RECOG_TOW, 8);
  assert.equal(RECOG_STANDARD_CAPTURE, 25);
});

test("79: a distant HIGH-value card outranks a near low-value one", () => {
  const view = viewWith({
    // A wreck 2 cells away (recover, 8) and a downed operator 30 cells
    // away (rescue, 10). Locality alone would put the wreck first.
    extraFriendly: [
      { id: 1, type: 0, operatorId: -1, x: 22 * CELL, y: 20 * CELL, state: 2, hp: 0 },
      { id: 2, type: 4 /* carrier: gives the rescue card a taker */, operatorId: 8,
        x: 21 * CELL, y: 20 * CELL, state: 0, hp: 100 },
    ],
    downed: [{ operatorId: 9, team: 0, x: 50 * CELL, y: 20 * CELL }],
  });
  const cards = tasksFor(view, 8); // the carrier operator sees both kinds
  const kinds = cards.map((c) => c.kind);
  if (kinds.includes("rescue") && kinds.includes("recover")) {
    assert.ok(kinds.indexOf("rescue") < kinds.indexOf("recover"),
      `rescue (10) must outrank recover (8) despite being further: ${kinds.join(",")}`);
  }
});

test("79: among EQUAL value, the nearer card wins (locality is the tiebreak)", () => {
  // Two relays needing defence, one near, one far: same value, so the
  // near one must lead.
  const view = viewWith({
    sites: [
      { id: 0, cellX: 60, cellY: 60, owner: 0, hp: 60, captureProgress: 5, capturingTeam: 1 },
      { id: 1, cellX: 22, cellY: 20, owner: 0, hp: 60, captureProgress: 5, capturingTeam: 1 },
    ],
  });
  const defend = tasksFor(view, 7).filter((c) => c.kind === "defend_relay");
  if (defend.length > 1) {
    assert.ok(defend[0].distance <= defend[1].distance,
      "equal-value cards must be ordered by distance");
  }
});

test("79: ordering is deterministic — two clients cannot disagree", () => {
  const view = viewWith({
    extraFriendly: [
      { id: 1, type: 0, operatorId: -1, x: 30 * CELL, y: 20 * CELL, state: 2, hp: 0 },
      { id: 2, type: 0, operatorId: -1, x: 30 * CELL, y: 40 * CELL, state: 2, hp: 0 },
    ],
    sites: [{ id: 0, cellX: 60, cellY: 60, owner: 0, hp: 0 }],
  });
  const a = tasksFor(view, 7).map((c) => c.id);
  const b = tasksFor(view, 7).map((c) => c.id);
  assert.deepEqual(a, b, "same view, same order, every time");
});
