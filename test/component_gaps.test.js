// test/component_gaps.test.js — component-level behavior gaps.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { hashState, createSnapshot } from "../engine/snapshot.js";
import { buildView } from "../engine/view.js";
import { AIRegency } from "../engine/ai_regency.js";
import { createInitialState, ASSET_DISABLED } from "../engine/state.js";
import { sandbox, joinAndSelect } from "./helpers.js";

test("component: call_medic stays a validated inert no-op; respawn is LIVE (15)", () => {
  let s = sandbox([{ team: 0, cellX: 0 }]);
  s = joinAndSelect(s, 0, 0, 0);
  const before = hashState(s);
  {
    const next = apply(s, { type: "call_medic", operatorId: 0 });
    assert.deepEqual(next.events, [], "call_medic emits nothing yet");
    assert.equal(hashState(next), before, "call_medic changes nothing yet");
  }
  {
    const next = apply(s, { type: "respawn", operatorId: 0 });
    assert.ok(next.events.some((e) => e.type === "respawn_called"),
      "respawn went live with the prompt-53 ruling");
    assert.notEqual(hashState(next), before, "respawn abandons the hull");
  }
  const invalid = apply(s, { type: "call_medic", operatorId: 99 });
  assert.equal(invalid.events[0].type, "rejected", "still validated");
});

test("component: views expose scores/phase and copy bases defensively", () => {
  const s = createInitialState(42, "frontier_corridor");
  s.teamScores = [15, 5];
  const view = buildView(s, 1);
  assert.deepEqual(view.teamScores, [15, 5]);
  assert.equal(view.phase, 0);
  assert.equal(view.bases.length, 2);
  view.bases[0].x = 999;
  view.teamScores[0] = 999;
  assert.equal(s.bases[0].x !== 999, true, "authoritative bases untouched");
  assert.equal(s.teamScores[0], 15, "authoritative scores untouched");
});

test("component: snapshot never leaks authoritative state or map internals", () => {
  const s = createInitialState(42, "frontier_corridor");
  const snap = createSnapshot(s);
  assert.deepEqual(Object.keys(snap).sort(), ["stateHash", "tick", "views"]);
  for (const view of snap.views) {
    // 11K: views carry a PUBLIC scoreboard — id/team/score only. The rest
    // of the operator table (assetId, timers, options) stays server-side.
    for (const op of view.operators) {
      assert.deepEqual(Object.keys(op).sort(), ["id", "score", "team"],
        "scoreboard rows leak nothing but the score");
    }
    for (const enemy of view.visibleEnemies) {
      assert.equal("hp" in enemy, false);
      assert.equal("operatorId" in enemy, false);
      // 12B: `deployed` IS public — a raised hardpoint is externally
      // obvious, like heading. Nothing else may leak.
      assert.deepEqual(Object.keys(enemy).sort(),
        ["deployed", "heading", "id", "state", "team", "type", "x", "y"]);
    }
  }
});

test("component: AI never issues commands for wrecked assets", () => {
  const s = createInitialState(42, "frontier_corridor");
  const ai = new AIRegency();
  let joined = s;
  for (const cmd of ai.plan(joined)) joined = apply(joined, cmd);
  for (const a of joined.assets) if (a.operatorId !== -1) a.state = ASSET_DISABLED;
  const commands = ai.plan(joined);
  assert.equal(commands.length, 0, "all crews wrecked, all quiet");
});

test("component: AI holds fire when out of supply", () => {
  let s = sandbox(
    [
      { team: 0, cellX: 40, cellY: 40, operatorId: 16 },
      { team: 1, cellX: 42, cellY: 40 },
    ],
    [],
    { bases: [{ team: 0, x: 0, y: 0, width: 2, height: 2 }] } // A far out of supply
  );
  s.operators[16] = { ...s.operators[16], state: 1, team: 0, assetId: 0 };
  const ai = new AIRegency({ fixedAgents: false });
  ai.assume(16);
  const commands = ai.plan(s);
  assert.equal(commands.some((c) => c.type === "fire_order"), false,
    "no doomed fire orders from a cut-off unit");
});

test("component: suppressed timer decrements exactly once per tick", () => {
  let s = sandbox([{ team: 0, cellX: 0, suppressedTimer: 3 }]);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].suppressedTimer, 2);
  s = apply(s, { type: "advance_tick" });
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].suppressedTimer, 0);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].suppressedTimer, 0, "floors at zero");
});
