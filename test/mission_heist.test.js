// test/mission_heist.test.js — Q52: the HEIST (one-sided standard
// grab on the mode framework). Only the defender keeps a standard;
// the attacker's carrier steals it home before the clock; the radio
// betrays the thief; reason 4 keeps its meaning, reason 8 is the
// vault holding.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../engine/state.js";
import { apply } from "../engine/reducer.js";
import {
  checkVictory, WIN_STANDARD, WIN_HEIST_TIMEOUT,
} from "../engine/victory.js";
import { MISSION_HEIST, CONVOY_PING_TICKS } from "../engine/mission.js";
import { STD_CARRIED, STD_SCORED } from "../engine/standards.js";

const HEIST_RULES = { mode: 2, modeAttacker: 0 };

test("heist: one standard (the defender's), a clock, and nothing else ends the war", () => {
  const s = createInitialState(42, "frontier_corridor", HEIST_RULES);
  assert.equal(s.mission.kind, MISSION_HEIST);
  assert.equal(s.standards.length, 1, "only the Asset exists");
  assert.equal(s.standards[0].team, 1, "and it is the DEFENDER'S");
  s.tickets = [0, 0];
  assert.equal(checkVictory(s), null, "tickets cannot end a mode war");
  s.mission.timerTicks = 0;
  assert.deepEqual(checkVictory(s), { winner: 1, reason: WIN_HEIST_TIMEOUT });
});

test("heist: the scored Asset is a STANDARD win for the attacker", () => {
  const s = createInitialState(42, "frontier_corridor", HEIST_RULES);
  s.standards[0].status = STD_SCORED;
  assert.deepEqual(checkVictory(s), { winner: 0, reason: WIN_STANDARD });
});

test("heist: the attacker CAN score with no standard of their own (canScore exception)", () => {
  let s = createInitialState(42, "frontier_corridor", HEIST_RULES);
  const carrier = s.assets.find((a) => a.team === 0 && a.type === 4);
  const std = s.standards[0];
  std.status = STD_CARRIED;
  std.carrierAssetId = carrier.id;
  // Park the thief inside their own base with the Asset aboard.
  const home = s.bases.find((b) => b.team === 0);
  carrier.x = (home.x + 2) * 256 + 128;
  carrier.y = (home.y + 2) * 256 + 128;
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: carrier.id, confirm: true });
  std.x = carrier.x; std.y = carrier.y;
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.standards[0].status, STD_SCORED, "delivered — the heist pays");
});

test("heist: the radio betrays the carried Asset to the DEFENDERS", () => {
  let s = createInitialState(42, "frontier_corridor", HEIST_RULES);
  const carrier = s.assets.find((a) => a.team === 0 && a.type === 4);
  s.standards[0].status = STD_CARRIED;
  s.standards[0].carrierAssetId = carrier.id;
  // Mid-map: in-base it would SCORE instantly (the heist exception).
  carrier.x = 64 * 256 + 128; carrier.y = 40 * 256 + 128;
  s.standards[0].x = carrier.x; s.standards[0].y = carrier.y;
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: carrier.id, confirm: true });
  for (let i = 0; i < CONVOY_PING_TICKS; i++) s = apply(s, { type: "advance_tick" });
  const ping = s.events.find((e) => e.type === "ping" && e.kind === "heist_asset");
  assert.ok(ping, "the Asset is on the air");
  assert.equal(ping.toTeam, 1, "for the DEFENDERS' ears");
});

test("141: the heist doctrine block is NEVER nested inside the convoy branch", async () => {
  // The dead-code class: the Q52 vault-guard/interceptor block sat
  // inside `if (mission.kind === MISSION_CONVOY)` from landing until
  // prompt 141 — mission.kind can't be 1 and 2 at once, so none of it
  // ever ran. Pin the structure: the heist doctrine `if` must sit at
  // plan scope (4-space indent), not buried in another branch.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../engine/ai_regency.js", import.meta.url), "utf8");
  const hits = src.split("\n").filter((l) =>
    l.includes("if (state.mission?.kind === MISSION_HEIST)"));
  assert.ok(hits.length >= 1, "the heist doctrine block exists");
  for (const l of hits) {
    assert.ok(/^ {4}if /.test(l),
      `heist doctrine must be at plan scope, got: "${l.slice(0, 24)}..."`);
  }
});
