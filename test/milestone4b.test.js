// test/milestone4b.test.js — Milestone 4B: event → audio cue mapping.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mapEventsToCues } from "../client/js/audio_cues.js";

const view = {
  friendlyAssets: [{ id: 0, x: 10 * 256, y: 5 * 256 }],
  visibleEnemies: [{ id: 4, x: 12 * 256, y: 5 * 256 }],
  sites: [{ id: 1, cellX: 30, cellY: 40 }],
};

test("4B combat, capture, resupply, and game end map to positioned cues", () => {
  const cues = mapEventsToCues([
    { type: "fire_resolved", attackerId: 0, targetId: 4, hpDelta: 20, targetHp: 60 },
    { type: "asset_disabled", assetId: 4 },
    { type: "site_captured", siteId: 1, team: 0 },
    { type: "resupplied", assetId: 0 },
    { type: "game_over", winner: 0, reason: 1 },
    { type: "operator_joined", operatorId: 1, team: 1 }, // unmapped
  ], view);

  assert.deepEqual(cues.map((c) => c.cue),
    ["fire_cannon", "explosion", "capture", "resupply", "war_over"]);
  assert.deepEqual(cues[0].at, { x: 10, y: 5 }, "cannon at the attacker");
  assert.deepEqual(cues[1].at, { x: 12, y: 5 }, "explosion at the victim");
  assert.deepEqual(cues[2].at, { x: 30.5, y: 40.5 }, "capture at the site");
  assert.equal(cues[4].at, null, "game over is non-positional");
});

test("4B events about fogged entities produce cues without position", () => {
  const cues = mapEventsToCues([{ type: "asset_disabled", assetId: 99 }], view);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].at, null);
});
