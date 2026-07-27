// test/rule_presets.test.js — 13G difficulty presets (playtest 6.7 ruling)
// over the 13F session-rules plumbing, plus the regression this slice
// uncovered: createAppServer silently DROPPED mapProfile and rules on the
// way into GameServer, so MAP=riverline served frontier.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DEFAULT_RULES, RULE_PRESETS, rulesForPreset } from "../engine/state.js";
import { createAppServer } from "../server/index.js";

test("normal preset IS the default law — byte-identical, forever", () => {
  assert.deepEqual(RULE_PRESETS.normal, DEFAULT_RULES);
  assert.equal(RULE_PRESETS.normal, DEFAULT_RULES, "same frozen object, not a copy");
});

test("preset numbers as ratified: easy 8/600, hard 4/1500", () => {
  assert.deepEqual(RULE_PRESETS.easy, { mpgMinOperable: 8, mpgTicks: 600 });
  assert.deepEqual(RULE_PRESETS.hard, { mpgMinOperable: 4, mpgTicks: 1500 });
});

test("rulesForPreset resolves names and refuses garbage", () => {
  assert.equal(rulesForPreset("hard"), RULE_PRESETS.hard);
  assert.throws(() => rulesForPreset("nightmare"), /unknown rules preset/);
});

test("createAppServer forwards mapProfile and rules into the war", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mf-presets-"));
  try {
    const appServer = createAppServer({
      mapSeed: 7,
      enableAi: false,
      replayDir: dir,
      mapProfile: "riverline",
      rules: rulesForPreset("hard"),
    });
    assert.equal(appServer.gameServer.state.mapProfile, "riverline");
    assert.equal(appServer.gameServer.state.rules.mpgMinOperable, 4);
    assert.equal(appServer.gameServer.state.rules.mpgTicks, 1500);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
