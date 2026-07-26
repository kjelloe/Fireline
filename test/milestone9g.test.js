// test/milestone9g.test.js — Slice 9G: the anti-camping drone (ruling Q7).
// Idle outside your supply umbrella long enough and the enemy's nearest
// owned relay launches a fast, terrain-blind, public drone that stings
// until you move, get back in supply, or shoot it down.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import {
  CAMP_TICKS, DRONE_SPEED, DRONE_LIFETIME, DRONE_HIT_INTERVAL, DRONE_DAMAGE,
} from "../engine/drone.js";
import { validate } from "../engine/commands.js";
import { OP_DOWN, ASSET_DISABLED } from "../engine/state.js";
import { buildView } from "../engine/view.js";
import { hashState } from "../engine/snapshot.js";
import { sandbox, joinAndSelect } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

// Corner bases, one relay per team (so nobody dominates during long camp
// loops). The camper at (40,10) is ~50 cells from home — deep off-supply.
const CAMP_OPTS = {
  bases: [
    { team: 0, x: 0, y: 60, width: 4, height: 4 },
    { team: 1, x: 60, y: 60, width: 4, height: 4 },
  ],
};
const RELAYS = [
  { cellX: 2, cellY: 56, owner: 0 },
  { cellX: 30, cellY: 10, owner: 1 }, // the enemy launch pad
];

function campingState(extraAssets = []) {
  return sandbox(
    [{ team: 0, cellX: 40, cellY: 10 }, ...extraAssets],
    RELAYS, CAMP_OPTS
  );
}

test("9G camping off-supply draws a drone from the enemy's nearest relay", () => {
  let s = campingState();
  for (let i = 0; i < CAMP_TICKS - 1; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].campTicks, CAMP_TICKS - 1, "the clock is running");
  assert.equal(s.drones.length, 0, "not yet");

  s = apply(s, { type: "advance_tick" });
  assert.equal(s.drones.length, 1);
  assert.deepEqual(
    s.events.find((e) => e.type === "drone_launched"),
    { type: "drone_launched", droneId: 0, targetAssetId: 0, siteId: 1 }
  );
  assert.deepEqual(
    { x: s.drones[0].x, y: s.drones[0].y, team: s.drones[0].team },
    { x: cellToWorld(30), y: cellToWorld(10), team: 1 },
    "launched from the enemy relay"
  );
  assert.equal(s.assets[0].campTicks, 0, "toll paid, clock restarts");

  // One drone per camper: another full camp cycle launches nothing new.
  for (let i = 0; i < CAMP_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.drones.length, 1, "no second drone for the same target");
});

test("9G supplied or moving units never camp; no enemy relay, no drone", () => {
  // Same spot but the unit idles inside its own base: supplied, no clock.
  let home = sandbox([{ team: 0, cellX: 1, cellY: 61 }], RELAYS, CAMP_OPTS);
  home = apply(home, { type: "advance_tick" });
  assert.equal(home.assets[0].campTicks, 0);

  // Off-supply but the enemy owns no relay: the clock fires into nothing.
  let noPad = sandbox(
    [{ team: 0, cellX: 40, cellY: 10 }],
    [{ cellX: 2, cellY: 56, owner: 0 }, { cellX: 30, cellY: 10, owner: 0 }],
    CAMP_OPTS
  );
  for (let i = 0; i < CAMP_TICKS + 5; i++) noPad = apply(noPad, { type: "advance_tick" });
  assert.equal(noPad.drones.length, 0, "nowhere to launch from");
});

test("9G the drone flies straight, stings on station, and can kill", () => {
  // A bystander in base keeps team 0 fielded so elimination never freezes
  // the war before the recall we assert on.
  let s = campingState([{ team: 0, cellX: 1, cellY: 61 }]);
  s.assets[0].hp = DRONE_DAMAGE * 2; // two stings from dead
  for (let i = 0; i < CAMP_TICKS; i++) s = apply(s, { type: "advance_tick" });
  const spawnX = s.drones[0].x;

  s = apply(s, { type: "advance_tick" });
  assert.equal(s.drones[0].x - spawnX, DRONE_SPEED, "full-speed straight chase");

  // 10 cells at 72/tick ≈ 36 ticks to station, then a sting every 10 ticks.
  let hits = 0;
  for (let i = 0; i < 40 + 2 * DRONE_HIT_INTERVAL && hits < 2; i++) {
    s = apply(s, { type: "advance_tick" });
    hits += s.events.filter((e) => e.type === "drone_hit").length;
  }
  assert.equal(hits, 2, "repeated light damage on station");
  assert.equal(s.assets[0].state, ASSET_DISABLED, "a camper can be pestered to death");
  s = apply(s, { type: "advance_tick" });
  assert.ok(
    s.events.some((e) => e.type === "drone_recalled"),
    "the drone breaks off once its target is a wreck"
  );
});

test("9G a lethal sting uses the shared disable path (crew bails out)", () => {
  let s = campingState();
  s = joinAndSelect(s, 0, 0, 0);
  s.assets[0].hp = DRONE_DAMAGE;
  for (let i = 0; i < CAMP_TICKS; i++) s = apply(s, { type: "advance_tick" });
  for (let i = 0; i < 40 + DRONE_HIT_INTERVAL; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.assets[0].state, ASSET_DISABLED);
  assert.equal(s.operators[0].state, OP_DOWN, "crew bailed out on foot");
  assert.equal(s.teamScores[1], 5, "drone kills score like gun kills");
});

test("9G moving (or getting resupplied) recalls the drone", () => {
  let s = campingState();
  s = joinAndSelect(s, 0, 0, 0);
  for (let i = 0; i < CAMP_TICKS; i++) s = apply(s, { type: "advance_tick" });
  assert.equal(s.drones.length, 1);

  s = apply(s, { type: "move_order", operatorId: 0, targetCellX: 41, targetCellY: 10 });
  s = apply(s, { type: "advance_tick" });
  assert.equal(s.drones.length, 0, "counterplay is simply to stop camping");
  assert.ok(s.events.some((e) => e.type === "drone_recalled"));
});

test("9G endurance: a drone expires after its lifetime; stubborn campers draw the next", () => {
  let s = campingState();
  for (let i = 0; i < CAMP_TICKS; i++) s = apply(s, { type: "advance_tick" });
  s.assets[0].hp = 10000; // sting-proof: the target just keeps camping
  let expired = false;
  for (let i = 0; i <= DRONE_LIFETIME && !expired; i++) {
    s = apply(s, { type: "advance_tick" });
    expired = s.events.some((e) => e.type === "drone_recalled" && e.droneId === 0);
  }
  assert.equal(expired, true, "endurance spent");
  assert.equal(s.drones.some((d) => d.id === 0), false);
  // By design: the camp clock keeps running, so a successor is already up
  // (or imminent) — camping is never free.
  for (let i = 0; i < CAMP_TICKS && s.drones.length === 0; i++) {
    s = apply(s, { type: "advance_tick" });
  }
  assert.equal(s.drones.length, 1, "a stubborn camper draws the next drone");
});

test("9G any direct gun downs a drone in one hit; artillery cannot track it", () => {
  // Staged drone (spawn plumbing covered above) hovering beside a supplied
  // tank and a supplied artillery piece near the team-0 relay.
  let s = sandbox(
    [
      { team: 0, cellX: 4, cellY: 56 },
      { team: 0, cellX: 5, cellY: 56, type: 2 },
    ],
    RELAYS, CAMP_OPTS
  );
  s.drones.push({
    id: 7, team: 1, x: cellToWorld(6), y: cellToWorld(56),
    targetAssetId: 0, ageTicks: 0, hitTimer: 0,
  });
  s.nextDroneId = 8;
  s = joinAndSelect(s, 0, 0, 0);
  s = joinAndSelect(s, 1, 0, 1);

  const arty = apply(s, { type: "fire_order", operatorId: 1, targetDroneId: 7 });
  assert.equal(arty.events[0].reason, "cannot track aircraft");

  const ghost = apply(s, { type: "fire_order", operatorId: 0, targetDroneId: 99 });
  assert.equal(ghost.events[0].reason, "no such drone");

  s = apply(s, { type: "fire_order", operatorId: 0, targetDroneId: 7 });
  assert.deepEqual(
    s.events.find((e) => e.type === "drone_downed"),
    { type: "drone_downed", droneId: 7, byAssetId: 0 }
  );
  assert.equal(s.drones.length, 0);
  assert.ok(s.assets[0].reloadTimer > 0, "shooting a drone is a real shot");

  assert.equal(validate({ type: "fire_order", operatorId: 0, targetDroneId: -1 }).ok, false);
  assert.equal(validate({ type: "fire_order", operatorId: 0, targetDroneId: 7 }).ok, true);
});

test("9G drones are public: both teams see them; hashed and deterministic", () => {
  const run = () => {
    let s = campingState();
    for (let i = 0; i < CAMP_TICKS + 20; i++) s = apply(s, { type: "advance_tick" });
    return s;
  };
  const a = run();
  assert.equal(buildView(a, 0).drones.length, 1, "victim team sees it");
  assert.equal(buildView(a, 1).drones.length, 1, "owner team sees it");
  assert.equal(hashState(a), hashState(run()));
  const b = run();
  b.drones[0].ageTicks += 1;
  assert.notEqual(hashState(a), hashState(b));
});
