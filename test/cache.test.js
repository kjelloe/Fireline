// test/cache.test.js — Q64/Q65/Q66 (prompt 145, specs/13): the WEAPONS
// CACHE — kind-5 pair on sawtooth's lane chokepoints, reload-tempo
// aura (-25% within 5 cells) to the OWNER, radiating while owned full
// stop; CACHE=0 (rules.cacheAura=false) is the kill-switch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../engine/reducer.js";
import { MAP_LAYOUTS } from "../engine/state.js";
import { KIND_CACHE } from "../engine/sites.js";
import { getUnitStats } from "../engine/units.js";
import { sandbox } from "./helpers.js";

test("cache: sawtooth declares an exact mirror pair; no other profile has one", () => {
  const pair = MAP_LAYOUTS.sawtooth.relayCells.filter((c) => c.kind === KIND_CACHE);
  assert.equal(pair.length, 2);
  assert.equal(127 - pair[0].cellX, pair[1].cellX, "x-mirror pair");
  assert.equal(pair[0].cellY, pair[1].cellY, "same row");
  for (const [name, layout] of Object.entries(MAP_LAYOUTS)) {
    if (name === "sawtooth") continue;
    assert.ok(!(layout.relayCells ?? []).some((c) => c.kind === KIND_CACHE),
      `${name} has no cache`);
  }
});

function warAtCache(rules = {}, owner = -1, shooterDx = 2) {
  // Sandbox (whole-map bases: supply stays neutral — the recorded trap).
  const s = sandbox(
    [
      { team: 0, cellX: 20 + shooterDx, cellY: 20, type: 0, operatorId: 0 },
      { team: 1, cellX: 20 + shooterDx + 2, cellY: 20, type: 0 },
    ],
    [{ cellX: 20, cellY: 20, kind: KIND_CACHE, owner }]
  );
  if (Object.keys(rules).length) s.rules = { ...(s.rules ?? {}), ...rules };
  s.operators[0].team = 0; s.operators[0].state = 1; s.operators[0].assetId = 0;
  return { s, cache: s.sites[0], shooter: s.assets[0], target: s.assets[1] };
}

function fire(s, shooter, target) {
  return apply(s, { type: "fire_order", operatorId: 0, targetAssetId: target.id });
}

test("cache: owned aura cuts reload 25%; unowned/enemy pays full; kill-switch reverts", () => {
  const base = getUnitStats(0).reloadTicks;
  let { s, shooter, target } = warAtCache({}, -1);
  let r = fire(s, shooter, target);
  assert.equal(r.assets[shooter.id].reloadTimer, base, "neutral cache gives nothing");
  ({ s, shooter, target } = warAtCache({}, 0));
  r = fire(s, shooter, target);
  assert.equal(r.assets[shooter.id].reloadTimer, (base * 3) >> 2, "owned aura fires");
  ({ s, shooter, target } = warAtCache({}, 1));
  r = fire(s, shooter, target);
  assert.equal(r.assets[shooter.id].reloadTimer, base, "their cache is not ours");
  ({ s, shooter, target } = warAtCache({ cacheAura: false }, 0));
  r = fire(s, shooter, target);
  assert.equal(r.assets[shooter.id].reloadTimer, base, "CACHE=0 reverts");
});

test("cache: the aura ends at 5 cells", () => {
  const base = getUnitStats(0).reloadTicks;
  const { s, shooter, target } = warAtCache({}, 0, 6); // one past the edge
  const r = fire(s, shooter, target);
  assert.equal(r.assets[shooter.id].reloadTimer, base);
});
