// test/legibility.test.js — post-playtest legibility slice: the pure model
// behind auto-crewing, the objective strip, and the mission briefing.
// Playtest #1 findings: "did not understand what was relay, no text on
// screen"; "tank felt slow" (pace fix pinned here too).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ownStandardLine, enemyStandardLine, relayTally, currentHint, briefingText, autoSelectTarget,
} from "../client/js/objective_model.js";
import { getUnitStats, UNIT_TANK } from "../engine/units.js";

function view({ ownStatus = 0, enemyStatus = 0, sites = [], friendly = [] } = {}) {
  return {
    standards: [
      { team: 0, status: ownStatus },
      { team: 1, status: enemyStatus },
    ],
    sites,
    friendlyAssets: friendly,
  };
}

test("legibility: pace fix is pinned — tank moves at 32 units/tick", () => {
  assert.equal(getUnitStats(UNIT_TANK).speed, 32);
});

test("legibility: standard status lines cover every state, team-relative", () => {
  assert.match(ownStandardLine(view(), 0), /SAFE/);
  assert.match(ownStandardLine(view({ ownStatus: 1 }), 0), /STOLEN/);
  assert.match(ownStandardLine(view({ ownStatus: 2 }), 0), /DROPPED/);
  assert.match(enemyStandardLine(view(), 0), /go steal it/);
  assert.match(enemyStandardLine(view({ enemyStatus: 1 }), 0), /WE HAVE IT/);
  assert.match(enemyStandardLine(view({ enemyStatus: 3 }), 0), /CAPTURED/);
});

test("legibility: relay tally counts yours/theirs/neutral", () => {
  const v = view({ sites: [{ owner: 0 }, { owner: 1 }, { owner: -1 }] });
  assert.deepEqual(relayTally(v, 0), { yours: 1, theirs: 1, neutral: 1, total: 3 });
  assert.deepEqual(relayTally(v, 1), { yours: 1, theirs: 1, neutral: 1, total: 3 });
});

test("legibility: the hint prioritizes the win condition over housekeeping", () => {
  const sites = [{ owner: -1 }];
  assert.match(currentHint(view({ enemyStatus: 1, sites }), 0), /ESCORT.*WIN/);
  assert.match(currentHint(view({ enemyStatus: 1, ownStatus: 2, sites }), 0),
    /RECOVER YOURS/, "carrying theirs while yours is missing");
  assert.match(currentHint(view({ ownStatus: 1, sites }), 0), /STOP the enemy carrier/);
  assert.match(currentHint(view({ ownStatus: 2, sites }), 0), /Touch your dropped standard/);
  assert.match(currentHint(view({ sites }), 0), /Capture RELAY/,
    "relay education is the default early-game hint");
  assert.match(currentHint(view({ sites: [{ owner: 0 }] }), 0), /Push for their Command Standard/);
});

test("legibility: briefing explains win, relays, fog, and controls", () => {
  const text = briefingText(0);
  assert.match(text, /GREEN \(west\)/);
  for (const must of [/WIN:/, /RELAYS/, /supply/, /fog/i, /Click:/]) {
    assert.match(text, must);
  }
  assert.match(briefingText(1), /RED \(east\)/);
});

test("legibility: auto-crew picks the lowest free operable asset exactly once", () => {
  const free = view({
    friendly: [
      { id: 9, state: 0, operatorId: -1 },
      { id: 3, state: 0, operatorId: -1 },
      { id: 1, state: 2, operatorId: -1 },  // wreck: never auto-crewed
      { id: 0, state: 0, operatorId: 7 },   // teammate's
    ],
  });
  assert.equal(autoSelectTarget(free, 4), 3);

  const alreadyMine = view({ friendly: [{ id: 3, state: 0, operatorId: 4 }] });
  assert.equal(autoSelectTarget(alreadyMine, 4), null, "rejoin keeps the old seat");

  const nothing = view({ friendly: [{ id: 1, state: 2, operatorId: -1 }] });
  assert.equal(autoSelectTarget(nothing, 4), null, "no operable free assets");
});
