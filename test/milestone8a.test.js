// test/milestone8a.test.js — Milestone 8A: Command Standard state model.
// Standards are physical, deterministic, hashed state objects, publicly
// visible in views (the deliberate fog exception that creates the drama).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStandards, standardTakeableBy, standardReturnableBy, canScore,
  STD_AT_BASE, STD_CARRIED, STD_DROPPED, STANDARD_HOMES,
} from "../engine/standards.js";
import { createInitialState } from "../engine/state.js";
import { hashState } from "../engine/snapshot.js";
import { buildView } from "../engine/view.js";
import { sandbox } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";

test("8A initial placement: one standard per team, at home, uncarried", () => {
  const s = createInitialState(42, "frontier_corridor");
  assert.equal(s.standards.length, 2);
  for (const [team, st] of s.standards.entries()) {
    assert.equal(st.team, team);
    assert.equal(st.status, STD_AT_BASE);
    assert.equal(st.carrierAssetId, -1);
    assert.equal(st.x, cellToWorld(STANDARD_HOMES[team].cellX));
    assert.equal(st.y, cellToWorld(STANDARD_HOMES[team].cellY));
  }
  // Homes must sit inside their own command zone.
  for (const st of s.standards) {
    const base = s.bases.find((b) => b.team === st.team);
    assert.ok(
      st.homeCellX >= base.x && st.homeCellX < base.x + base.width &&
      st.homeCellY >= base.y && st.homeCellY < base.y + base.height,
      `standard ${st.id} home inside its command zone`
    );
  }
});

test("8A standards are hashed: any field change alters the state hash", () => {
  const a = createInitialState(42, "frontier_corridor");
  const h0 = hashState(a);
  const b = createInitialState(42, "frontier_corridor");
  b.standards[1].status = STD_DROPPED;
  assert.notEqual(hashState(b), h0);
  const c = createInitialState(42, "frontier_corridor");
  c.standards[0].x += 256;
  assert.notEqual(hashState(c), h0);
});

test("8A both teams always see both standards in their views", () => {
  const s = createInitialState(42, "frontier_corridor");
  for (const team of [0, 1]) {
    const view = buildView(s, team);
    assert.equal(view.standards.length, 2);
    assert.deepEqual(view.standards.map((st) => st.team), [0, 1]);
    view.standards[0].x = 999; // defensive copy
    assert.notEqual(s.standards[0].x, 999);
  }
});

test("8A takeable: only the ENEMY standard, only when grounded", () => {
  const s = sandbox(
    [{ team: 0, cellX: 10 }],
    [], { standards: [{ team: 0, cellX: 10 }, { team: 1, cellX: 10 }] }
  );
  const takeable = standardTakeableBy(s, s.assets[0]);
  assert.equal(takeable.team, 1, "enemy standard on my cell is takeable");

  s.standards[1].status = STD_CARRIED;
  assert.equal(standardTakeableBy(s, s.assets[0]), null, "carried is not grounded");
});

test("8A returnable: own standard only when dropped", () => {
  const s = sandbox(
    [{ team: 0, cellX: 10 }],
    [], { standards: [{ team: 0, cellX: 10, status: STD_DROPPED }] }
  );
  assert.equal(standardReturnableBy(s, s.assets[0]).team, 0);
  s.standards[0].status = STD_AT_BASE;
  assert.equal(standardReturnableBy(s, s.assets[0]), null, "at-base needs no return");
});

test("8A scoring gate requires own standard AT_BASE and carrier in own zone", () => {
  const inZone = sandbox(
    [{ team: 0, cellX: 1, cellY: 1 }],
    [],
    {
      bases: [{ team: 0, x: 0, y: 0, width: 4, height: 4 }],
      standards: [{ team: 0, cellX: 2 }, { team: 1, cellX: 1, cellY: 1, status: STD_CARRIED, carrierAssetId: 0 }],
    }
  );
  assert.equal(canScore(inZone, inZone.assets[0]), true);

  inZone.standards[0].status = STD_DROPPED; // own standard missing
  assert.equal(canScore(inZone, inZone.assets[0]), false, "recover yours first");

  inZone.standards[0].status = STD_AT_BASE;
  inZone.assets[0].x = cellToWorld(20); // outside command zone
  assert.equal(canScore(inZone, inZone.assets[0]), false);
});

test("8A wrecks can neither take nor return standards", () => {
  const s = sandbox(
    [{ team: 0, cellX: 10, state: 2, hp: 0 }],
    [], { standards: [{ team: 0, cellX: 10, status: STD_DROPPED }, { team: 1, cellX: 10 }] }
  );
  assert.equal(standardTakeableBy(s, s.assets[0]), null);
  assert.equal(standardReturnableBy(s, s.assets[0]), null);
});
