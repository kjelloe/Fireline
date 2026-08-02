// test/session_rules.test.js — prompt 146: --mode joins --map as a
// first-class server argument. The app layer honours options.mode (the
// CLI path) over the MODE env, and an explicit standard beats the env
// (the 11M MAP-blind lesson applied to modes before it could bite).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createAppServer } from "../server/index.js";

test("146: options.mode (the --mode CLI path) starts a mission war; CLI beats env", () => {
  const app = createAppServer({ mapSeed: 42, enableAi: false, mode: 1, modeAttacker: 1 });
  assert.equal(app.gameServer.state.mission.kind, 1, "convoy live");
  assert.equal(app.gameServer.state.mission.attacker, 1);
  process.env.MODE = "heist";
  try {
    const app2 = createAppServer({ mapSeed: 42, enableAi: false, mode: 0 });
    assert.equal(app2.gameServer.state.mission, null, "explicit standard beats MODE env");
    const app3 = createAppServer({ mapSeed: 42, enableAi: false });
    assert.equal(app3.gameServer.state.mission.kind, 2, "env still honoured when CLI silent");
  } finally {
    delete process.env.MODE;
  }
});
