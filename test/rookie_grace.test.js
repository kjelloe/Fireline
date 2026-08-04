// test/rookie_grace.test.js — W4-2 (prompt 174 ruling): a player's FIRST
// war draws no anti-camping drone. New players idle out of supply while
// reading the UI; being stung for it is the worst possible 60-second
// impression. The flag rides the join (client reads mf_coached), is
// hashed per operator, and only ever REMOVES a pest — so a lying client
// buys nothing competitive. AI regents never set it, so sims are
// unchanged.

import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { CAMP_TICKS } from "../engine/drone.js";
import { sandbox } from "./helpers.js";
import { cellToWorld } from "../shared/fixedmath.js";
import { buildView } from "../engine/view.js";

// A camper needs: an owned enemy relay to launch from, and to sit IDLE
// outside its own supply umbrella. Bases are explicit here (the sandbox
// default whole-map bases would keep everyone supplied forever).
function camperState({ rookie }) {
  let s = sandbox(
    [{ team: 0, cellX: 40, cellY: 40 }],
    [{ cellX: 42, cellY: 40, owner: 1 }],
    {
      bases: [
        { team: 0, x: 0, y: 0, width: 4, height: 8 },
        { team: 1, x: 60, y: 0, width: 4, height: 8 },
      ],
    }
  );
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0, rookie });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: 0, confirm: true });
  return s;
}

function campUntilDrone(s) {
  for (let i = 0; i < CAMP_TICKS + 5; i++) {
    s = apply(s, { type: "advance_tick" });
    if (s.drones.length > 0) return { s, launched: true };
  }
  return { s, launched: false };
}

test("W4-2: a veteran camping out of supply still draws the drone", () => {
  const { s, launched } = campUntilDrone(camperState({ rookie: false }));
  assert.equal(launched, true, "the anti-camping rule still bites");
  assert.equal(s.drones[0].targetAssetId, 0);
  assert.equal(s.operators[0].rookie, 0, "veteran flag is stored as 0");
});

test("W4-2: a ROOKIE camping the same way draws nothing", () => {
  const { s, launched } = campUntilDrone(camperState({ rookie: true }));
  assert.equal(launched, false, "the first war is drone-free");
  assert.equal(s.operators[0].rookie, 1, "rookie flag is hashed state");
  assert.equal(s.assets[0].campTicks, 0, "and the camp clock never accrues");
});

test("W4-2: the flag is per-operator, not global", () => {
  let s = sandbox(
    [{ team: 0, cellX: 40, cellY: 40 }, { team: 0, cellX: 44, cellY: 40 }],
    [{ cellX: 42, cellY: 40, owner: 1 }],
    {
      bases: [
        { team: 0, x: 0, y: 0, width: 4, height: 8 },
        { team: 1, x: 60, y: 0, width: 4, height: 8 },
      ],
    }
  );
  s = apply(s, { type: "join_operator", operatorId: 0, team: 0, rookie: true });
  s = apply(s, { type: "select_asset", operatorId: 0, assetId: 0, confirm: true });
  s = apply(s, { type: "join_operator", operatorId: 1, team: 0, rookie: false });
  s = apply(s, { type: "select_asset", operatorId: 1, assetId: 1, confirm: true });
  for (let i = 0; i < CAMP_TICKS + 5; i++) s = apply(s, { type: "advance_tick" });
  const targets = s.drones.map((d) => d.targetAssetId);
  assert.ok(!targets.includes(0), "the rookie is spared");
  assert.ok(targets.includes(1), "the veteran beside them is not");
});

test("W4-2: an omitted rookie flag means veteran (AI regents, old clients)", () => {
  let s = sandbox([{ team: 0, cellX: 10, cellY: 10 }]);
  s = apply(s, { type: "join_operator", operatorId: 3, team: 0 });
  assert.equal(s.operators[3].rookie, 0, "absence is never rookie");
});

test("W4-2: the client sees campTicks so it can warn before the launch", () => {
  const s = camperState({ rookie: false });
  let cur = s;
  for (let i = 0; i < 50; i++) cur = apply(cur, { type: "advance_tick" });
  const view = buildView(cur, 0);
  const me = view.friendlyAssets.find((a) => a.id === 0);
  assert.ok(me.campTicks > 0, `campTicks is projected (${me.campTicks})`);
  assert.ok(me.campTicks < CAMP_TICKS, "and it is the live clock, not the cap");
  assert.equal(cellToWorld(40), cur.assets[0].x, "the camper never moved");
});
