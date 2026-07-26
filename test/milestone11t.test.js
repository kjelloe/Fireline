// test/milestone11t.test.js — Slice 11T: public tasks (plan 2.4) as a
// pure fog-safe view-model. Mission cards derive ONLY from the team's
// view; priority is what-loses-the-war-fastest; every card's ping is a
// legal 10C kind for a standing seat.

import { test } from "node:test";
import assert from "node:assert/strict";
import { tasksFor } from "../client/js/tasks_model.js";
import { PING_KINDS } from "../engine/pings.js";
import { apply } from "../engine/reducer.js";
import { buildView } from "../engine/view.js";
import { sandbox, joinAndSelect } from "./helpers.js";

const CELL = 256;

test("11T priorities: stolen standard > dropped > escort > rescue > defend > recover > repair", () => {
  const view = {
    team: 0,
    standards: [
      { team: 0, status: 1, x: 30 * CELL, y: 10 * CELL, carrierAssetId: 99 },
      { team: 1, status: 1, x: 40 * CELL, y: 10 * CELL, carrierAssetId: 4 },
    ],
    friendlyAssets: [
      { id: 4, state: 0, x: 40 * CELL, y: 10 * CELL, towedBy: -1, recoverTimer: 0 },
      { id: 7, state: 2, x: 50 * CELL, y: 12 * CELL, towedBy: -1, recoverTimer: 0 },
    ],
    downedOperators: [{ operatorId: 5, x: 20 * CELL, y: 20 * CELL }],
    sites: [
      { id: 0, owner: 0, capturingTeam: 1, hp: 60, cellX: 32, cellY: 63 },
      { id: 1, owner: 0, capturingTeam: -1, hp: 0, cellX: 58, cellY: 63 },
    ],
  };
  const kinds = tasksFor(view, 0).map((t) => t.kind);
  assert.deepEqual(kinds, [
    "stop_thief", "secure_standard", "escort_carrier", "rescue",
    "defend_relay", "recover", "repair_site",
  ].filter((k) => k !== "secure_standard"), "full urgency ladder");
  // (own standard is CARRIED by the enemy here, so no 'dropped' card)
  const stop = tasksFor(view, 0)[0];
  assert.deepEqual({ x: stop.cellX, y: stop.cellY }, { x: 30, y: 10 });
});

test("11T your own downed body is not a card; pings are legal standing kinds", () => {
  const view = {
    team: 1,
    standards: [],
    friendlyAssets: [],
    downedOperators: [{ operatorId: 8, x: 0, y: 0 }, { operatorId: 3, x: CELL, y: 0 }],
    sites: [],
  };
  const tasks = tasksFor(view, 8);
  assert.equal(tasks.length, 1, "my own body is the R-prompt, not a mission");
  assert.equal(tasks[0].label.includes("operator 3"), true);
  for (const t of tasksFor(view, null)) {
    assert.ok(PING_KINDS.includes(t.ping), t.ping);
    assert.notEqual(t.ping, "need_rescue", "standing seats cannot cry need_rescue");
  }
});

test("11T fog safety is inherited: enemy wrecks and unmarked threats never card", () => {
  // A real engine view: team 1's view knows nothing of team 0's wreck.
  let s = sandbox([
    { team: 0, cellX: 10, state: 2, hp: 0 },
    { team: 1, cellX: 60 },
    { team: 0, cellX: 50 },
  ]);
  const enemyView = buildView(s, 1);
  const kinds = tasksFor(enemyView, null).map((t) => t.kind);
  assert.equal(kinds.includes("recover"), false, "their wreck is not our mission");

  const ownView = buildView(s, 0);
  assert.equal(tasksFor(ownView, null).some((t) => t.kind === "recover"), true,
    "but it IS the owning team's mission");
});

test("11T cards are stable and deduplicated by place", () => {
  const view = {
    team: 0,
    standards: [],
    friendlyAssets: [
      { id: 1, state: 2, x: 10 * CELL, y: 10 * CELL, towedBy: -1, recoverTimer: 0 },
      { id: 2, state: 2, x: 10 * CELL, y: 10 * CELL, towedBy: 5, recoverTimer: 0 },
    ],
    downedOperators: [],
    sites: [],
  };
  const tasks = tasksFor(view, null);
  assert.equal(tasks.length, 1, "a claimed wreck (towed) is nobody's mission");
  assert.equal(tasks[0].id, "recover:10,10", "stable id for the HUD diff");
});

test("11U towing a wreck flips its card to a green in-progress mission", () => {
  const view = {
    team: 0,
    standards: [],
    friendlyAssets: [
      { id: 1, type: 3, state: 0, operatorId: 7, x: 10 * CELL, y: 10 * CELL, towedBy: -1, recoverTimer: 0 },
      { id: 2, state: 2, x: 10 * CELL, y: 10 * CELL, towedBy: 1, recoverTimer: 0 },
      { id: 3, state: 2, x: 20 * CELL, y: 10 * CELL, towedBy: -1, recoverTimer: 0 },
    ],
    downedOperators: [],
    sites: [],
  };
  const mine = tasksFor(view, 7);
  assert.equal(mine[0].kind, "towing_now", "my tow outranks the open wreck");
  assert.equal(mine[0].mine, true);
  assert.equal(mine[1].kind, "recover", "the other wreck still cards");

  const teammate = tasksFor(view, 99);
  assert.equal(teammate.some((t) => t.kind === "towing_now"), false,
    "someone else's tow is a claimed wreck, not my mission");
});

test("11X props are deterministic, terrain-correct, and density-bounded", async () => {
  const { propsFor } = await import("../client/js/props_model.js");
  const { generateFrontierCorridor } = await import("../engine/frontier_corridor.js");
  const map = generateFrontierCorridor(42);
  const a = propsFor(map.cells, map.width, map.height);
  const b = propsFor(map.cells, map.width, map.height);
  assert.deepEqual(a, b, "same forest for every client");
  assert.ok(a.length > 100, `the field is dressed (${a.length} props)`);

  const at = (x, y) => map.cells[Math.floor(y) * map.width + Math.floor(x)];
  for (const p of a) {
    const terrain = at(p.x, p.y);
    if (p.kind === "tree") assert.equal(terrain, 2, `tree on forest at ${p.x},${p.y}`);
    if (p.kind === "rock") assert.equal(terrain, 3, `rock on rough at ${p.x},${p.y}`);
    if (p.kind === "rut") assert.equal(terrain, 5, `rut on path at ${p.x},${p.y}`);
  }
  const forestCells = map.cells.filter((c) => c === 2).length;
  const trees = a.filter((p) => p.kind === "tree").length;
  assert.ok(trees > forestCells / 6 && trees < forestCells / 2,
    `tree density sane (${trees} of ${forestCells} forest cells)`);
});

test("13E fog ghosts: born on vanish, cleared on return, faded on schedule", async () => {
  const { updateGhosts, ghostOpacity, GHOST_TTL_MS } = await import("../client/js/ghosts_model.js");
  const enemy = { id: 20, type: 0, team: 1, x: 5 * CELL, y: 5 * CELL, heading: 64 };

  let ghosts = updateGhosts([], { visibleEnemies: [enemy] }, 1000);
  assert.equal(ghosts.length, 1);
  assert.equal(ghostOpacity(ghosts[0], 1000), 0, "no ghost while the real thing shows");

  ghosts = updateGhosts(ghosts, { visibleEnemies: [] }, 2000);
  assert.equal(ghosts[0].visible, false, "vanished: the memory remains");
  assert.deepEqual({ x: ghosts[0].x, h: ghosts[0].heading }, { x: 5 * CELL, h: 64 },
    "frozen at the last seen pose");
  assert.ok(ghostOpacity(ghosts[0], 2000) > 0.85, "fresh memory is strong");
  assert.ok(ghostOpacity(ghosts[0], 2000 + GHOST_TTL_MS / 2) < 0.6, "and it fades");

  const back = updateGhosts(ghosts, { visibleEnemies: [enemy] }, 3000);
  assert.equal(back.filter((g) => g.id === 20 && !g.visible).length, 0, "reappearance clears the ghost");

  const gone = updateGhosts(ghosts, { visibleEnemies: [] }, 2000 + GHOST_TTL_MS + 1);
  assert.equal(gone.length, 0, "memory expires completely");
});

test("14A riverline dressing: water on the river, rails on bridges, nothing on frontier", async () => {
  const { propsFor } = await import("../client/js/props_model.js");
  const { generateRiverline } = await import("../engine/riverline.js");
  const { generateFrontierCorridor } = await import("../engine/frontier_corridor.js");

  const river = generateRiverline(42);
  const props = propsFor(river.cells, river.width, river.height, "riverline");
  const water = props.filter((p) => p.kind === "water");
  const rails = props.filter((p) => p.kind === "rail");
  assert.ok(water.length > 500, `the river reads as water (${water.length})`);
  assert.ok(rails.length >= 12, `bridges have rails (${rails.length})`);
  for (const w of water) {
    assert.equal(river.cells[Math.floor(w.y) * river.width + Math.floor(w.x)], 3,
      "water only over river rough");
  }
  for (const r of rails) {
    assert.equal(river.cells[Math.floor(r.y) * river.width + Math.floor(r.x)], 1,
      "rails only on bridge road");
  }

  const front = generateFrontierCorridor(42);
  const fprops = propsFor(front.cells, front.width, front.height, "frontier_corridor");
  assert.equal(fprops.some((p) => ["water", "rail", "reed"].includes(p.kind)), false,
    "frontier gets no river dressing");
});

test("15B locale catalogs are key-identical and parameterized strings fill", async () => {
  const { CATALOGS, t, setLocale, hasKey } = await import("../client/js/strings.js");
  assert.deepEqual(Object.keys(CATALOGS.no).sort(), Object.keys(CATALOGS.en).sort(),
    "en and no cover the same keys — no half-translated UI");
  try {
    setLocale("no");
    assert.equal(t("ping.attack"), "ANGRIP HER");
    assert.equal(t("task.recover", { id: 7 }), "Berg enhet 7 — tau den hjem");
    const { describeRejection } = await import("../client/js/feedback_model.js");
    assert.equal(describeRejection("out of ammo"), "Tom for ammunisjon — etterforsyn i basen.");
    assert.equal(describeRejection("gremlins"), "Ordre avvist: gremlins", "fallback localizes too");
  } finally {
    setLocale("en");
  }
  assert.equal(t("rej.out of ammo"), "Out of ammo — resupply at base.");
  assert.equal(hasKey("rej.out of ammo"), true);
  assert.equal(hasKey("rej.nonsense"), false);
  assert.equal(setLocale("klingon"), "en", "unknown locales refuse politely");
});

test("15B the models speak the active locale", async () => {
  const { setLocale } = await import("../client/js/strings.js");
  const { pingOptionsFor } = await import("../client/js/ping_model.js");
  try {
    setLocale("no");
    const opts = pingOptionsFor({ friendlyAssets: [], downedOperators: [], standards: [] }, 0);
    assert.equal(opts[0].label, "ANGRIP HER");
    const tasks = tasksFor({
      team: 0, standards: [], downedOperators: [{ operatorId: 3, x: 0, y: 0 }],
      friendlyAssets: [], sites: [],
    }, null);
    assert.ok(tasks[0].label.startsWith("Redd operatør 3"));
  } finally {
    setLocale("en");
  }
});
