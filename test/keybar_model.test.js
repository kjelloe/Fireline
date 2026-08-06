// test/keybar_model.test.js — prompt 211: the on-screen key bar model.
// Context-curated per embodiment, gray = carried-but-unavailable,
// absent = the chassis can never, blink only when ready.

import { test } from "node:test";
import assert from "node:assert/strict";
import { keyBarFor } from "../client/js/keybar_model.js";
import { CATALOGS } from "../client/js/strings.js";

const W = (c) => c * 256 + 128;
const hull = (over = {}) => ({
  id: 0, operatorId: 3, type: 0, state: 0, x: W(10), y: W(10),
  ammo: 12, fuel: 4000, aboard1: -1, aboard2: -1, stationOp: -1,
  minesLeft: 0, caltropsLeft: 0, sandbagsLeft: 0, cargoFuel: 0, cargoAmmo: 0,
  deployTimer: 0, towedBy: -1, ...over,
});
const view = (assets, downed = []) => ({ friendlyAssets: assets, downedOperators: downed });
const actions = (bar) => bar.map((e) => e.action);
const entry = (bar, a) => bar.find((e) => e.action === a);

test("a tank driver: redeploy/mine/direct/pings — no truck keys, no sandbags", () => {
  const bar = keyBarFor(view([hull({ minesLeft: 3 })]), 3);
  assert.deepEqual(actions(bar), ["redeploy", "mine", "directDrive", "ping1", "ping2", "ping3"]);
  assert.equal(entry(bar, "mine").ready, true);
});

test("empty mine rack grays M; a light hull's caltrops light it again", () => {
  const empty = keyBarFor(view([hull({ minesLeft: 0 })]), 3);
  assert.equal(entry(empty, "mine").ready, false, "carried but rack empty");
  const light = keyBarFor(view([hull({ type: 1, caltropsLeft: 2 })]), 3);
  assert.equal(entry(light, "mine").ready, true, "caltrops ride the same key");
});

test("a truck driver gets the logistics cluster; tow is gray without an adjacent wreck", () => {
  const solo = keyBarFor(view([hull({ type: 3 })]), 3);
  assert.deepEqual(actions(solo),
    ["redeploy", "tow", "transfer", "clearMine", "directDrive", "ping1", "ping2", "ping3"]);
  assert.equal(entry(solo, "tow").ready, false);
  const wreck = hull({ id: 4, operatorId: -1, state: 2, x: W(11), y: W(10) });
  const near = keyBarFor(view([hull({ type: 3 }), wreck]), 3);
  assert.equal(entry(near, "tow").ready, true, "adjacent wreck lights T");
});

test("transfer needs BOTH cargo and an adjacent needy hull", () => {
  const needy = hull({ id: 5, operatorId: 8, ammo: 2, x: W(11), y: W(10) });
  const noCargo = keyBarFor(view([hull({ type: 3 }), needy]), 3);
  assert.equal(entry(noCargo, "transfer").ready, false);
  const cargo = keyBarFor(view([hull({ type: 3, cargoAmmo: 6 }), needy]), 3);
  assert.equal(entry(cargo, "transfer").ready, true);
});

test("board appears only beside a carrier with a free bunk", () => {
  const carrier = hull({ id: 6, operatorId: 9, type: 4, x: W(11), y: W(10) });
  const bar = keyBarFor(view([hull(), carrier]), 3);
  assert.ok(actions(bar).includes("board"));
  const full = keyBarFor(view([hull(), { ...carrier, aboard1: 1, aboard2: 2 }]), 3);
  assert.ok(!actions(full).includes("board"), "full bunks: no B");
});

test("downed: R + the rescue ping, R gray until the crawl-first window passes", () => {
  const early = keyBarFor(view([], [{ operatorId: 3, downTicks: 40, x: W(5), y: W(5) }]), 3);
  assert.deepEqual(actions(early), ["redeploy", "ping1"]);
  assert.equal(early[0].ready, false);
  const late = keyBarFor(view([], [{ operatorId: 3, downTicks: 100, x: W(5), y: W(5) }]), 3);
  assert.equal(late[0].ready, true);
});

test("aboard a carrier: U, plus J when the ring is open", () => {
  const open = hull({ id: 6, operatorId: 9, type: 4, aboard1: 3 });
  assert.deepEqual(actions(keyBarFor(view([open]), 3)), ["unboard", "station"]);
  const manned = hull({ id: 6, operatorId: 9, type: 4, aboard1: 3, stationOp: 7 });
  assert.deepEqual(actions(keyBarFor(view([manned]), 3)), ["unboard"]);
});

test("stationed: J (leave) alone; bodiless: empty bar", () => {
  const mount = hull({ id: 6, operatorId: 9, type: 4, stationOp: 3 });
  assert.deepEqual(actions(keyBarFor(view([mount]), 3)), ["station"]);
  assert.deepEqual(keyBarFor(view([hull({ operatorId: 9 })]), 3), []);
});

test("sentinel: hardpoint, gray mid-cycle; sandbags light N on a stocked truck", () => {
  const sen = keyBarFor(view([hull({ type: 7 })]), 3);
  assert.equal(entry(sen, "hardpoint").ready, true);
  const cyc = keyBarFor(view([hull({ type: 7, deployTimer: 20 })]), 3);
  assert.equal(entry(cyc, "hardpoint").ready, false);
  const bags = keyBarFor(view([hull({ type: 3, sandbagsLeft: 2 })]), 3);
  assert.ok(actions(bags).includes("sandbag"));
});

test("blink marks only the READY suggested key", () => {
  const bar = keyBarFor(view([hull({ type: 3 })]), 3, { blinkKey: "tow" });
  assert.equal(entry(bar, "tow").blink, false, "gray keys never blink — that would be a lie");
  const wreck = hull({ id: 4, operatorId: -1, state: 2, x: W(11), y: W(10) });
  const near = keyBarFor(view([hull({ type: 3 }), wreck]), 3, { blinkKey: "tow" });
  assert.equal(entry(near, "tow").blink, true);
  assert.ok(near.filter((e) => e.blink).length === 1);
});

test("the bar never exceeds 11 entries", () => {
  // A truck beside a wreck, carrier, and needy hull, fully stocked.
  const assets = [
    hull({ type: 3, cargoAmmo: 5, sandbagsLeft: 2, caltropsLeft: 2 }),
    hull({ id: 4, operatorId: -1, state: 2, x: W(11), y: W(10) }),
    hull({ id: 6, operatorId: 9, type: 4, x: W(9), y: W(10) }),
    hull({ id: 7, operatorId: 8, ammo: 1, x: W(10), y: W(11) }),
  ];
  assert.ok(keyBarFor(view(assets), 3).length <= 11);
});

test("lint: every bar action has a tooltip string in BOTH locales", () => {
  const ACTIONS = ["redeploy", "board", "unboard", "station", "tow", "transfer",
    "mine", "clearMine", "sandbag", "hardpoint", "directDrive",
    "ping1", "ping2", "ping3"];
  for (const locale of ["en", "no"]) {
    for (const a of ACTIONS) {
      assert.ok(`keybar.${a}` in CATALOGS[locale], `${locale} missing keybar.${a}`);
    }
  }
});
