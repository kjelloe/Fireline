// test/landship.test.js — Q42: the neutral capturable fortress.
// One hull per war (id 32, team -1). The select IS the capture;
// driver alone moves it; the heavy station is the incentive to crew
// up; either team tows the wreck; the respawn law rotates berths and
// clears the wreck when it fires. Never the MPG's business.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import {
  createInitialState, LANDSHIP_SPAWNS, landshipBerth,
  ASSET_IDLE, ASSET_DISABLED,
} from "../engine/state.js";
import { UNIT_LANDSHIP, getUnitStats } from "../engine/units.js";
import { cellToWorld, worldToCellFloor } from "../shared/fixedmath.js";

const LS = 32;

test("landship: one neutral hull per war, berthed on the centre column", () => {
  const s = createInitialState(42, "frontier_corridor");
  const hull = s.assets[LS];
  assert.equal(hull.type, UNIT_LANDSHIP);
  assert.equal(hull.team, -1, "nobody's until claimed");
  assert.equal(hull.operatorId, -1);
  assert.equal(worldToCellFloor(hull.x), 64, "centre column — mirror-exact");
  // Seed parity alternates the first berth.
  const s2 = createInitialState(43, "frontier_corridor");
  assert.notEqual(s.assets[LS].y, s2.assets[LS].y, "first berth alternates by seed");
  assert.equal(s.landship.respawnTicks, 0);
});

test("landship: the select IS the capture — for either team, only while uncrewed", () => {
  let s = createInitialState(42, "frontier_corridor");
  s = apply(s, { type: "join_operator", operatorId: 0, team: 1 });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: LS, confirm: true });
  assert.equal(s.assets[LS].team, 1, "claimed by the boarder's team");
  assert.equal(s.assets[LS].operatorId, 0);
  assert.ok(s.events.some((e) => e.type === "landship_captured" && e.team === 1));
  // A CREWED landship is protected like any hull.
  s = apply(s, { type: "join_operator", operatorId: 1, team: 0 });
  const denied = apply(s, { type: "select_asset", operatorId: 1, assetId: LS, confirm: true });
  assert.equal(denied.events.at(-1).reason, "asset belongs to other team");
  // Abandoned (driver leaves): it KEEPS the team but uncrewed —
  // the enemy may now walk up and take it.
  s.assets[LS].operatorId = -1;
  s.operators[0].assetId = -1;
  const stolen = apply(s, { type: "select_asset", operatorId: 1, assetId: LS, confirm: true });
  assert.equal(stolen.assets[LS].team, 0, "recaptured by the other side");
});

test("landship: driver alone moves it; the heavy station exists", () => {
  let s = createInitialState(42, "frontier_corridor");
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: LS, confirm: true });
  const cy = worldToCellFloor(s.assets[LS].y);
  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 64, targetCellY: cy + 4 });
  const y0 = s.assets[LS].y;
  for (let i = 0; i < 12; i++) s = apply(s, { type: "advance_tick" });
  assert.ok(s.assets[LS].y !== y0, "driver alone moves the fortress");
  const st = getUnitStats(UNIT_LANDSHIP).station;
  assert.equal(st.kind, "hmg");
  assert.ok(st.damage > getUnitStats(UNIT_LANDSHIP).damage, "the station outguns the driver seat");
});

test("landship: either team tows the wreck; the respawn clears it at the next berth", () => {
  let s = createInitialState(42, "frontier_corridor");
  const hull = s.assets[LS];
  hull.team = 0; // was A's when it died
  hull.state = ASSET_DISABLED;
  hull.hp = 0;
  // Team B's truck may hook it (Q42: everyone's prize).
  const bTruck = s.assets.find((a) => a.team === 1 && getUnitStats(a.type).canTow);
  bTruck.x = hull.x + 256; bTruck.y = hull.y;
  s = apply(s, { type: "join_operator", operatorId: 0, team: 1 });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: bTruck.id, confirm: true });
  s = apply(s, { type: "tow_order", operatorId: 0, wreckAssetId: LS });
  assert.equal(s.assets[LS].towedBy, bTruck.id, "enemy tow accepted for the landship");
  // The clock starts on the first wrecked tick and fires ~100 s later.
  s = apply(s, { type: "advance_tick" });
  assert.ok(s.landship.respawnTicks > 0, "the clock is running");
  const nextIdx = s.landship.spawnIdx;
  s.landship.respawnTicks = 1; // fast-forward to the deadline
  s = apply(s, { type: "advance_tick" });
  const reborn = s.assets[LS];
  assert.equal(reborn.state, ASSET_IDLE);
  assert.equal(reborn.team, -1, "reborn neutral");
  assert.equal(reborn.hp, getUnitStats(UNIT_LANDSHIP).hp);
  assert.equal(reborn.towedBy, -1, "the hook comes back empty");
  const berth = landshipBerth(s.map, nextIdx);
  assert.equal(worldToCellFloor(reborn.x), berth[0]);
  assert.equal(worldToCellFloor(reborn.y), berth[1]);
  assert.ok(s.events.some((e) => e.type === "landship_respawned"));
});

test("landship: the MPG never rebuilds it — its own law only", () => {
  let s = createInitialState(42, "frontier_corridor");
  // Wreck the landship as team A's AND gut team A below the MPG bar.
  s.assets[LS].team = 0;
  s.assets[LS].state = ASSET_DISABLED;
  for (const a of s.assets) {
    if (a.team === 0 && a.id >= 8 && a.id <= 19) a.state = ASSET_DISABLED;
  }
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: 0, confirm: true });
  const need = s.rules.mpgTicks + 5;
  for (let i = 0; i < need; i++) s = apply(s, { type: "advance_tick" });
  // Reserves rebuilt by the wave; the landship was NOT — it came back
  // (if at all) through its own respawn law, at a BERTH, neutral.
  const hull = s.assets[LS];
  if (hull.state !== ASSET_DISABLED) {
    assert.equal(hull.team, -1, "only the respawn law touches it, and that law rebirths NEUTRAL");
    assert.equal(worldToCellFloor(hull.x), 64, "at a centre-column berth, not a team base");
  }
});

test("landship: exempt from abandoned-hull self-recall; the station is boardable", () => {
  let s = createInitialState(42, "frontier_corridor");
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0 });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: LS, confirm: true });
  // Forced respawn abandons it: the recall clock must NOT wreck the
  // fortress (nor charge B1 for a hull the war itself owns).
  s.assets[LS].operatorId = -1;
  s.operators[0].assetId = -1;
  s.assets[LS].abandonTimer = 1;
  const tickets0 = [...s.tickets];
  for (let i = 0; i < 700; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[LS].state, ASSET_IDLE, "still standing, still stealable");
  assert.deepEqual(s.tickets.map((t, i) => tickets0[i] - t <= 700 / 20 + 1), [true, true],
    "no recall ticket charged (only ordinary bleed moves the pools)");
  assert.equal(s.assets[LS].team, 0, "keeps its paint while abandoned");
  // Station intersection (prompt-100 machinery on the new hull):
  let s2 = createInitialState(42, "frontier_corridor");
  s2 = apply(s2, { type: "join_operator", operatorId: 0, team: 0 });
  s2 = apply(s2, { type: "select_asset", operatorId: 0, assetId: LS, confirm: true });
  s2 = apply(s2, { type: "join_operator", operatorId: 1, team: 0 });
  s2 = apply(s2, { type: "board_station", operatorId: 1, assetId: LS });
  assert.equal(s2.assets[LS].stationOp, 1, "the heavy station takes a gunner");
});

test("A-keyed hunt: the neutral landship NEVER draws a camp drone", () => {
  let s = createInitialState(2026, "frontier_corridor", {});
  // idle every crewed asset in supply (base) — only the landship sits
  // unsupplied mid-map. Advance well past the camping threshold.
  for (let i = 0; i < 1500; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[32].campTicks, 0, "the fortress is not a camper");
  assert.ok(!s.drones.some((d) => d.targetAssetId === 32), "no drone hunts it");
  assert.ok(!s.events.some((e) => e.type === "asset_disabled" && e.assetId === 32),
    "and it was never farmed for score");
  assert.deepEqual([...s.teamScores], [0, 0], "no free points for anyone");
});

test("A-keyed hunt: a CAPTURED landship is a camper like any hull", () => {
  let s = createInitialState(2026, "frontier_corridor", {});
  s.assets[32].team = 0; // someone claimed it, then left it idle mid-map
  for (let i = 0; i < 400; i++) s = apply(s, { type: "advance_tick" });
  assert.ok(s.assets[32].campTicks > 0, "the exemption is for NEUTRAL only");
});
