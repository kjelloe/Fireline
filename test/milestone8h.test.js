// test/milestone8h.test.js — Milestone 8H: order feedback + end-of-war summary.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REJECTION_TEXT, describeRejection, describeEvent, describeWinReason, summarizeGameOver,
} from "../client/js/feedback_model.js";
import { apply } from "../engine/reducer.js";
import { sandbox, joinAndSelect } from "./helpers.js";

test("8H every rejection reason the reducer can emit has human text", () => {
  // Sweep the engine sources for reject(...) reasons and demand coverage.
  const sources = ["reducer.js", "recovery.js"]
    .map((f) => readFileSync(new URL(`../engine/${f}`, import.meta.url), "utf8"))
    .join("\n");
  const reasons = new Set(
    [...sources.matchAll(/re(?:ject\(next, command|turn) "([a-z][^"]+)"/g)].map((m) => m[1])
  );
  for (const m of sources.matchAll(/reject\(next, command, "([^"]+)"\)/g)) reasons.add(m[1]);
  for (const m of sources.matchAll(/return "([^"]+)";/g)) reasons.add(m[1]);
  assert.ok(reasons.size >= 20, `found ${reasons.size} reasons`);
  for (const reason of reasons) {
    assert.ok(REJECTION_TEXT[reason], `missing feedback text for "${reason}"`);
  }
});

test("8H unknown reasons still produce a readable fallback", () => {
  assert.equal(describeRejection("gremlins"), "Order rejected: gremlins");
});

test("8H event lines are team-perspective", () => {
  const taken = { type: "standard_taken", standardId: 1, assetId: 0, byTeam: 0 };
  assert.match(describeEvent(taken, 0), /WE HAVE THEIR STANDARD/);
  assert.match(describeEvent(taken, 1), /THEY TOOK OUR STANDARD/);

  const relay = { type: "site_captured", siteId: 2, team: 1 };
  assert.match(describeEvent(relay, 1), /secured/);
  assert.match(describeEvent(relay, 0), /lost to the enemy/);

  assert.equal(describeEvent({ type: "game_over", winner: 0, reason: 4 }, 0), null,
    "game_over goes to the end screen, not the feed");
});

test("8H live rejection round-trip: reducer reason → readable text", () => {
  let s = sandbox([{ team: 0, cellX: 0 }, { team: 1, cellX: 1 }]);
  s = joinAndSelect(s, 0, 0, 0);
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 });
  s = apply(s, { type: "fire_order", operatorId: 0, targetAssetId: 1 }); // reloading
  const line = describeEvent(s.events[0], 0);
  assert.equal(line, "Weapon reloading.");
});

test("8H end-of-war summary covers win, loss, draw, and reasons", () => {
  const view = (winner, winReason) => ({
    phase: 1, winner, winReason, teamScores: [40, 25],
  });
  assert.equal(summarizeGameOver(view(0, 4), 0).title, "VICTORY");
  assert.equal(summarizeGameOver(view(0, 4), 1).title, "DEFEAT");
  assert.equal(summarizeGameOver(view(-1, 3), 0).title, "DRAW");
  assert.equal(summarizeGameOver(view(0, 4), 0).reason, "Command Standard captured");
  assert.equal(describeWinReason(1), "enemy force eliminated");
  assert.deepEqual(summarizeGameOver(view(0, 4), 0).scores, [40, 25]);
  assert.equal(summarizeGameOver({ phase: 0 }, 0), null, "no summary mid-war");
});
