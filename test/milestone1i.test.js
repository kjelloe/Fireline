// test/milestone1i.test.js — Milestone 1I: relay sites, capture, fog extension.
// Ported to the authoritative engine: capture happens in the advance_tick
// capture pass for operable assets standing on a site cell; owned relays act
// as team sensors. Covers the six acceptance criteria in phases/phase1/plan.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, createInitialState } from "../engine/reducer.js";
import { SITE_RELAY, SITE_NEUTRAL, RELAY_FOG_CELLS, captureCheck } from "../engine/sites.js";
import { ASSET_IDLE, ASSET_DISABLED } from "../engine/state.js";
import { buildView } from "../engine/view.js";
import { cellToWorld } from "../shared/fixedmath.js";
import { hashState } from "../engine/snapshot.js";
import { sandbox, joinSelectMove } from "./helpers.js";

test("1I neutral relay has no owner in initial state", () => {
  const s = createInitialState(42, "frontier_corridor");
  assert.equal(s.sites.length, 8); // 11C road pairs 32<->95, 58<->69 + prompt-51 lateral pairs 44<->83 N+S
  for (const site of s.sites) {
    assert.equal(site.type, SITE_RELAY);
    assert.equal(site.owner, SITE_NEUTRAL);
  }
});

test("1I asset moving onto relay captures it (and changes owner to asset team)", () => {
  let s = sandbox(
    [{ team: 0, cellX: 0 }],
    [{ cellX: 3 }]
  );
  s = joinSelectMove(s, 0, 0, 0, 3, 0);
  let captured = null;
  for (let i = 0; i < 60 && !captured; i++) {
    s = apply(s, { type: "advance_tick" });
    captured = s.events.find((e) => e.type === "site_captured") ?? null;
  }
  assert.ok(captured, "capture event must fire");
  assert.deepEqual(captured, { type: "site_captured", siteId: 0, team: 0 });
  assert.equal(s.sites[0].owner, 0);
  assert.equal(s.assets[0].x, cellToWorld(3), "asset stands on the relay");
});

test("1I owning relay extends fog radius for that team", () => {
  const enemyCell = 40;
  const relayCell = enemyCell - RELAY_FOG_CELLS;
  const noRelay = sandbox(
    [{ team: 0, cellX: 0 }, { team: 1, cellX: enemyCell }],
    [{ cellX: relayCell, owner: SITE_NEUTRAL }]
  );
  assert.equal(buildView(noRelay, 0).visibleEnemies.length, 0, "neutral relay grants nothing");

  const owned = sandbox(
    [{ team: 0, cellX: 0 }, { team: 1, cellX: enemyCell }],
    [{ cellX: relayCell, owner: 0 }]
  );
  assert.equal(buildView(owned, 0).visibleEnemies.length, 1, "owned relay reveals enemy");
  assert.equal(buildView(owned, 1).visibleEnemies.length, 0, "enemy team gains nothing");
});

test("1I enemy recapture changes owner back", () => {
  // Second relay owned by team 1: the 11B contested freeze would otherwise
  // let team 0 hold the only relay long enough for a domination win.
  let s = sandbox(
    [{ team: 0, cellX: 3 }, { team: 1, cellX: 6 }],
    [{ cellX: 3, owner: SITE_NEUTRAL }, { cellX: 60, owner: 1 }]
  );
  for (let i = 0; i < 30 && s.sites[0].owner !== 0; i++) {
    s = apply(s, { type: "advance_tick" }); // 11B: neutral relay takes ~3 s
  }
  assert.equal(s.sites[0].owner, 0, "team 0 captures by standing on it");

  s = joinSelectMove(s, 1, 1, 1, 3, 0);
  for (let i = 0; i < 400 && s.sites[0].owner !== 1; i++) {
    s = apply(s, { type: "advance_tick" });
  }
  // Both assets share the cell; asset order decides, and asset 0 (team 0)
  // comes first, so ownership flips to team 1 only after asset 0 leaves —
  // move asset 0 away to let the recapture land. Route it PERPENDICULAR
  // to the attacker (17: driving straight through an enemy hull is now
  // body-blocked; in live wars guns resolve that standoff, but this
  // reducer-only test has no shooters).
  s = joinSelectMove(s, 0, 0, 0, 3, 20);
  let flipped = false;
  for (let i = 0; i < 200 && !flipped; i++) {
    s = apply(s, { type: "advance_tick" });
    flipped = s.sites[0].owner === 1;
  }
  assert.equal(s.sites[0].owner, 1, "team 1 recaptures after team 0 leaves");
});

test("1I view includes sites array with correct fields", () => {
  // 11B: capture countdown telemetry is public, like ownership itself.
  const s = sandbox(
    [{ team: 0, cellX: 0 }],
    [{ cellX: 5, cellY: 7, owner: 0 }]
  );
  const view = buildView(s, 1);
  assert.equal(view.sites.length, 1);
  assert.deepEqual(view.sites[0], {
    id: 0, type: SITE_RELAY, owner: 0, cellX: 5, cellY: 7,
    captureProgress: 0, capturingTeam: -1,
    hp: 60, // 11F
  });
});

// ── additional 1I self-tests ──────────────────────────────────────────────────

test("1I captureCheck is pure and ignores wrecks", () => {
  const s = sandbox(
    [{ team: 0, cellX: 3, state: ASSET_DISABLED, hp: 0 }],
    [{ cellX: 3 }]
  );
  assert.equal(captureCheck(s, 0), null, "wreck cannot capture");
  const before = JSON.stringify(s.sites);
  const live = sandbox([{ team: 0, cellX: 3 }], [{ cellX: 3 }]);
  const site = captureCheck(live, 0);
  assert.equal(site.id, 0);
  assert.equal(JSON.stringify(s.sites), before, "captureCheck never mutates");
});

test("1I standing on an owned relay emits no repeat capture events", () => {
  let s = sandbox([{ team: 0, cellX: 3 }], [{ cellX: 3 }]);
  let captures = 0;
  for (let i = 0; i < 40; i++) { // 11B: capture lands once the countdown runs
    s = apply(s, { type: "advance_tick" });
    captures += s.events.filter((e) => e.type === "site_captured").length;
  }
  assert.equal(captures, 1);
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.events.filter((e) => e.type === "site_captured").length, 0);
});

test("1I sites are hashed: ownership change alters state hash", () => {
  const a = sandbox([{ team: 0, cellX: 0 }], [{ cellX: 3 }]);
  const b = sandbox([{ team: 0, cellX: 0 }], [{ cellX: 3, owner: 1 }]);
  assert.notEqual(hashState(a), hashState(b));
});
