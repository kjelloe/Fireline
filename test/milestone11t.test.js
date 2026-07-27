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
    assert.equal(river.cells[Math.floor(w.y) * river.width + Math.floor(w.x)], 6,
      "water props only over T_WATER (12C)");
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

test("15B part 2: event feed and end screen speak the active locale", async () => {
  const { setLocale } = await import("../client/js/strings.js");
  const { describeEvent, describeWinReason, summarizeGameOver } =
    await import("../client/js/feedback_model.js");
  try {
    setLocale("no");
    assert.equal(describeEvent({ type: "standard_taken", byTeam: 0 }, 0),
      "VI HAR STANDARTEN DERES! Eskorter den hjem!");
    assert.equal(describeEvent({ type: "operator_rescued", byAssetId: 8, operatorId: 3 }, 0),
      "Vogn 8 plukket opp operatør 3!");
    assert.equal(describeWinReason(4), "kommandostandarten erobret");
    assert.equal(summarizeGameOver({ phase: 1, winner: 0, winReason: 4, teamScores: [1, 0] }, 0).title,
      "SEIER");
  } finally {
    setLocale("en");
  }
  assert.equal(describeWinReason(4), "Command Standard captured", "historic wording pinned");
  assert.equal(describeEvent({ type: "mine_deployed", team: 0, minesLeft: 1 }, 0),
    "Mine laid (1 left in the rack).");
  assert.equal(describeEvent({ type: "mine_deployed", team: 1, minesLeft: 1 }, 0), null,
    "enemy mine lays stay silent (fog)");
});

test("15C keybinds: defaults, overrides, and corrupt storage all behave", async () => {
  const { DEFAULT_BINDS, loadBinds, saveBinds } = await import("../client/js/keybinds.js");
  const mem = new Map();
  const storage = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, v),
  };
  assert.deepEqual(loadBinds(storage), DEFAULT_BINDS, "fresh storage = defaults");

  const binds = loadBinds(storage);
  binds.tow = "y";
  saveBinds(binds, storage);
  assert.equal(loadBinds(storage).tow, "y", "override persists");
  assert.equal(loadBinds(storage).redeploy, "r", "others keep defaults");

  mem.set("mf_binds", "{corrupt");
  assert.deepEqual(loadBinds(storage), DEFAULT_BINDS, "corrupt storage falls back");
  mem.set("mf_binds", JSON.stringify({ tow: "TOO_LONG", mine: 5 }));
  assert.deepEqual(loadBinds(storage), DEFAULT_BINDS, "invalid values rejected");
});

test("14G map detailing: dashes on road, bushes in forest, compounds mirror", async () => {
  const { propsFor, baseCompound } = await import("../client/js/props_model.js");
  const { generateFrontierCorridor } = await import("../engine/frontier_corridor.js");
  const map = generateFrontierCorridor(42);
  const props = propsFor(map.cells, map.width, map.height);
  const at = (x, y) => map.cells[Math.floor(y) * map.width + Math.floor(x)];
  const dashes = props.filter((p) => p.kind === "dash");
  const bushes = props.filter((p) => p.kind === "bush");
  assert.ok(dashes.length > 50 && bushes.length > 100, "the field is detailed");
  for (const d of dashes) assert.equal(at(d.x, d.y), 1, "dashes only on road");
  for (const b of bushes) assert.equal(at(b.x, b.y), 2, "bushes only in forest");

  // Compounds: deterministic, inside the rect, and the east base is the
  // exact mirror of the west one (both HQs face the front line).
  const west = { x: 6, y: 54, width: 18, height: 20 };
  const east = { x: 104, y: 54, width: 18, height: 20 };
  const a = baseCompound(west, false);
  const b = baseCompound(east, true);
  assert.deepEqual(a, baseCompound(west, false), "deterministic");
  for (const piece of [...a, ...b]) {
    const rect = a.includes(piece) ? west : east;
    assert.ok(piece.x >= rect.x && piece.x <= rect.x + rect.width, `${piece.kind} inside x`);
    assert.ok(piece.y >= rect.y && piece.y <= rect.y + rect.height, `${piece.kind} inside y`);
  }
  for (let i = 0; i < a.length; i++) {
    const westOffset = a[i].x - west.x;
    const eastOffset = b[i].x - east.x;
    assert.ok(Math.abs(westOffset + eastOffset - west.width) < 0.001,
      `${a[i].kind} mirrors across the front`);
    assert.equal(a[i].y, b[i].y, `${a[i].kind} same depth`);
  }
});

test("14I codex and status models answer the commander's questions", async () => {
  const { codexFor } = await import("../client/js/codex.js");
  const { statusFor } = await import("../client/js/status_model.js");

  const carrier = codexFor(4);
  assert.equal(carrier.name, "carrier");
  assert.ok(carrier.traits.includes("carries the standard"));
  assert.ok(carrier.traits.includes("2 rescue bunks"));
  const bike = codexFor(5);
  assert.ok(bike.traits.includes("cannot capture relays"));
  const sentinel = codexFor(7);
  assert.ok(String(sentinel.lines.find(([k]) => k === "range")[1]).includes("deployed"));
  assert.equal(codexFor(99), null, "unknown chassis: no entry, no crash");

  // Status: the exact why-nots, worst first.
  const dry = statusFor({ id: 3, type: 0, hp: 40, ammo: 0, fuel: 0, reloadTimer: 0,
    suppressedTimer: 0, deployed: 0, deployTimer: 0 });
  const keys = dry.reasons.map((r) => r.key);
  assert.ok(keys.includes("status.no_fuel") && keys.includes("status.no_ammo"));
  assert.equal(dry.canRequestSupplies, true, "the fuel-mission button appears");

  const fine = statusFor({ id: 3, type: 0, hp: 100, ammo: 12, fuel: 4000, reloadTimer: 7,
    suppressedTimer: 0, deployed: 0, deployTimer: 0 });
  assert.deepEqual(fine.reasons.map((r) => r.key), ["status.reloading"]);
  assert.equal(fine.canRequestSupplies, false);

  const unsupplied = statusFor({ id: 3, type: 0, hp: 100, ammo: 12, fuel: 4000, reloadTimer: 0,
    suppressedTimer: 0, deployed: 0, deployTimer: 0 }, { inSupplyNow: false });
  assert.equal(unsupplied.reasons[0].key, "status.no_supply");
});

test("14I need_supplies is a legal standing ping in both catalogs", async () => {
  const { PING_KINDS } = await import("../engine/pings.js");
  const { CATALOGS } = await import("../client/js/strings.js");
  assert.ok(PING_KINDS.includes("need_supplies"));
  assert.ok("ping.need_supplies" in CATALOGS.en && "ping.need_supplies" in CATALOGS.no);
});

test("14J mission cards fit the asset: capability filter, one per kind, distance", () => {
  const CELLP = 256;
  const view = {
    team: 0,
    standards: [],
    friendlyAssets: [
      { id: 1, type: 0, operatorId: 9, x: 10 * CELLP, y: 10 * CELLP, towedBy: -1, recoverTimer: 0 }, // my tank
      { id: 2, state: 2, x: 12 * CELLP, y: 10 * CELLP, towedBy: -1, recoverTimer: 0 },
      { id: 3, state: 2, x: 40 * CELLP, y: 10 * CELLP, towedBy: -1, recoverTimer: 0 },
    ],
    downedOperators: [{ operatorId: 5, x: 14 * CELLP, y: 10 * CELLP }],
    sites: [{ id: 0, owner: 0, capturingTeam: 1, hp: 60, cellX: 20, cellY: 10 }],
  };
  // A tank: no tow, no bunks — recover and rescue cards are NOT its missions.
  const tank = tasksFor(view, 9);
  const kinds = tank.map((x) => x.kind);
  assert.equal(kinds.includes("recover"), false, "tanks don't tow");
  assert.equal(kinds.includes("rescue"), false, "tanks have no bunks");
  assert.ok(kinds.includes("defend_relay"), "combat cards remain");

  // A truck sees ONE recover card — the nearest of the two wrecks.
  view.friendlyAssets[0].type = 3;
  const truck = tasksFor(view, 9);
  const recovers = truck.filter((x) => x.kind === "recover");
  assert.equal(recovers.length, 1, "one card per kind");
  assert.equal(recovers[0].cellX, 12, "the nearest wreck wins");
  assert.equal(typeof recovers[0].distance, "number");

  // Seatless viewers (garage) still see the full board.
  const garage = tasksFor(view, 99).map((x) => x.kind);
  assert.ok(garage.includes("recover") && garage.includes("rescue"));
});
