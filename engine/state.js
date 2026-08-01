// engine/state.js — authoritative state schema and initial state (1E contract).
// Reconstructed: the 1E state module was lost during the 1F merge. Field layout
// follows engine/snapshot.js hashState and test/fixtures/1A_reducer.json.
// 32 operator slots: 0..15 humans, 16..23 AI regency, 24..31 reserved.
// 8 field assets: 0..3 team A (west base), 4..7 team B (east base).

import { generateFrontierCorridor, FRONTIER_CORRIDOR } from "./frontier_corridor.js";
import { generateRiverline } from "./riverline.js";
import { generateBlackwood } from "./blackwood.js";
import { generateCaldera } from "./caldera.js";
import { generateSawtooth } from "./sawtooth.js";
import { createBridges } from "./bridges.js";
import { createDrops } from "./drops.js";
import { createPrisons, PREPLACED_POWS } from "./prisons.js";
import { cellToWorld } from "../shared/fixedmath.js";
import { AMMO_MAX, FUEL_MAX } from "./supply.js";
import { MINES_PER_TANK } from "./mines.js";
import { SANDBAGS_PER_TRUCK } from "./sandbags.js";
import { speedMultiplier } from "./terrain.js";
import { getUnitStats } from "./units.js";
import { createStandards } from "./standards.js";
import { createMission } from "./mission.js";

export const OP_ABSENT = 0;
export const OP_ACTIVE = 1;
export const OP_DOWN = 2;
// POW arc (specs/12 Q35): a captive's seat is LOCKED — no join, no
// select, no respawn — until freed and delivered home.
export const OP_CAPTIVE = 3;

export const ASSET_IDLE = 0;
export const ASSET_MOVING = 1;
export const ASSET_DISABLED = 2;
export const ASSET_SALVAGED = 3;

// Suppression is a timer, not an asset state: it coexists with IDLE/MOVING.
export function isSuppressed(asset) {
  return asset.suppressedTimer > 0;
}

export const OPERATOR_COUNT = 32;
export const TEAM_COUNT = 2;

export const MAP_PROFILES = {
  frontier_corridor: generateFrontierCorridor,
  riverline: generateRiverline, // 11M
  blackwood: generateBlackwood, // 18A
  sawtooth: generateSawtooth,   // 18B
  caldera: generateCaldera,     // item 40 (the circle map)
};

// Spawn layout. Asset numbering is compatibility-layered: ids 0-7 keep the
// original 4v4 arrangement (0-3 team A col 7, 4-7 team B col 120 — positions
// and chassis pinned by 1A/1B/1D tests). Ids 8-19 are team A reserves and
// 20-31 team B reserves (32 field assets total — the v1 "32 players" scale).
// Original eight keep the pinned tank/tank/scout/artillery pattern; reserves
// cycle all four chassis so each team fields logistics trucks (tow role).
const SPAWN_ROWS = [56, 58, 60, 62];
const SPAWN_TYPES = [0, 0, 1, 2];
// 9A: explicit 12-slot reserve mix. The first four are AI-crewed (ops 24-27 /
// 28-31): carrier, truck, scout, tank — so AI regents can raid AND rescue.
// Per-team totals: 5 tanks, 3 scouts, 3 artillery, 3 trucks, 2 carriers.
// 11R: garage slot idx 4 (ids 12 / 24) traded from tank to Scout Bike.
// 11S: garage slot idx 6 (ids 14 / 26) traded from artillery to Mortar.
// 12B/12C (designer directive): the FACTION UNIQUES replace garage slot
// idx 10 (ids 18 / 30) — Directorate Sentinel west, Outlier Skimmer east.
// No 17th asset; indices 0-3 stay AI-paired and never reorder.
const RESERVE_TYPES_BY_TEAM = [
  [4, 3, 1, 0, 5, 1, 6, 3, 2, 3, 7, 4], // team 0: The Directorate
  [4, 3, 1, 0, 5, 1, 6, 3, 2, 3, 8, 4], // team 1: The Outliers — Skimmer
];
const TEAM_A_SPAWN_X = 7;
// 11C balance fix: 117 put B three cells closer to the center relay than
// A's mirror (127-7=120) — B won the middle race and the war in 5/5 sim
// seeds. Spawns are now exact mirrors.
const TEAM_B_SPAWN_X = 120;
const RESERVE_ROWS = [55, 57, 59, 61, 63, 65];
const TEAM_A_RESERVE_COLS = [8, 9];
// Q42: landship rotation points — centre column (width>>1, the B6 drop
// precedent), north/south of the road so respawns move the fight.
export const LANDSHIP_SPAWNS = [[64, 52], [64, 75]];
// The berth must be STANDABLE (sawtooth's mesas cover the nominal
// points): walk the centre column outward (y±1, y±2 …) to the first
// cell the landship can occupy. x never changes, so the x-mirror
// stays exact; the down-first tie-break is y-only and mirror-inert.
export function landshipBerth(map, idx) {
  const [bx, by] = LANDSHIP_SPAWNS[idx];
  const stats = getUnitStats(9);
  const standable = (y) => {
    if (y < 0 || y >= map.height) return false;
    return speedMultiplier(map.cells[y * map.width + bx], stats) > 0;
  };
  if (standable(by)) return [bx, by];
  for (let d = 1; d < map.height; d++) {
    if (standable(by + d)) return [bx, by + d];
    if (standable(by - d)) return [bx, by - d];
  }
  return [bx, by]; // a fully-walled column: nominal (never happens on real maps)
}
const TEAM_B_RESERVE_COLS = [119, 118]; // mirror of A's [8, 9]

function createOperators() {
  const operators = [];
  for (let id = 0; id < OPERATOR_COUNT; id++) {
    // B4: deeds are per-CATEGORY recognition counts (indices are the
    // reducer's DEED_* constants) — the raw material of category honors.
    operators.push({ id, team: -1, state: OP_ABSENT, assetId: -1, score: 0, downTimer: 0, lastPingTick: -1000000, autoRescue: 1, respawnTicks: 0, carrierSpawnAt: 0, deeds: [0, 0, 0, 0, 0, 0, 0, 0] });
  }
  return operators;
}

function makeFieldAsset(id, type, team, cellX, cellY) {
  const x = cellToWorld(cellX);
  const y = cellToWorld(cellY);
  return {
    id, type, team, state: ASSET_IDLE,
    x, y, targetX: x, targetY: y,
    heading: team === 1 ? 128 : 0, // brads: A faces east, B faces west (9F)
    aboard1: -1, aboard2: -1, // 9B: carrier bunks (operator ids)
    // Prompt-100 stations: the second seat (operator id), its missile
    // rack, and its own reload clock. Zeroes on station-less chassis.
    stationOp: -1,
    stationAmmo: getUnitStats(type).station?.shots ?? 0,
    stationReload: 0,
    ejectTimer: 0, // Q41: driver-eject countdown
    // POW slice 2: the scout's custody — a prisoner aboard (operator
    // id) and the 3s capture hold clock.
    prisoner: -1,
    captureTicks: 0,
    hp: getUnitStats(type).hp, operatorId: -1, moveProgress: 0, suppressedTimer: 0,
    ammo: AMMO_MAX, fuel: FUEL_MAX,
    towedBy: -1, recoverTimer: 0, // 8D tow-back recovery
    reloadTimer: 0, // 8E fire cooldown
    minesLeft: getUnitStats(type).canMine ? MINES_PER_TANK : 0, // 9E mine rack
    caltropsLeft: getUnitStats(type).caltrops ?? 0, // Q45 chase-shaper rack
    sandbagsLeft: getUnitStats(type).canClearMines ? SANDBAGS_PER_TRUCK : 0, // Q45/Q50
    campTicks: 0, // 9G: unsupplied-idle counter that draws a drone
    materiel: 0, // 11F: one repair-cargo slot (trucks load it in base)
    cargoFuel: 0, cargoAmmo: 0, // 13A: field-resupply hold (trucks)
    driveThrottle: 0, driveTurn: 0, // 11L: direct-control intent
    deployed: 0, deployTimer: 0, // 12B: Deploy Hardpoint
    abandonTimer: 0, // 15: forced-respawn self-recall clock
    // Item 34: queued move orders (shift-click / long-press). Bounded so
    // the hashed state stays small; the AI never queues, so regent
    // behaviour and every balance measurement are untouched.
    waypoints: [],
  };
}

// Deterministic original spawn (cell + type) for any field asset id — used
// by the Slow Manufacture rebuild (9D). When `bases` (from live state) is
// given, the rebuild column derives from the team's ACTUAL base — so a
// world-reflected war rebuilds inside its (mirrored) base instead of at
// the unmirrored constant columns. That constant-table shortcut was the
// documented MIRROR-sweep caveat; collision's longer wars made it
// load-bearing (rebuilds spawning behind enemy lines → 47 phantom
// dominations in one 300-war mirrored battery). Type/row still come from
// the pinned tables — roster identity never moves.
// Mirror-true base centre COLUMN (specs/08 §7b — the prison bug's
// twin): an even-width rect has no self-mirror column, and
// `x + (w/2|0)` from the west edge picks the 10th column on BOTH
// sides — the mirror of A's 10th is B's 9th. East-half bases count
// from their east edge instead.
export function baseCentreCol(base, mapWidth = 128) {
  const half = (base.width / 2) | 0;
  const west = base.x + half;
  return 2 * (base.x + half) < mapWidth ? west : base.x + base.width - 1 - half;
}

export function fieldSpawnFor(id, bases = null) {
  // Layout: 0-3 team A originals, 4-7 team B originals, 8-19 team A
  // reserves, 20-31 team B reserves (see createFieldAssets).
  const team = id < 8 ? (id < 4 ? 0 : 1) : (id < 20 ? 0 : 1);
  const base = bases?.find?.((b) => b.team === team);
  const centerCol = base ? baseCentreCol(base) : null;
  if (id < 8) {
    const slot = id % 4;
    const spawnX = centerCol ?? (team === 0 ? TEAM_A_SPAWN_X : TEAM_B_SPAWN_X);
    return { team, type: SPAWN_TYPES[slot], cellX: spawnX, cellY: SPAWN_ROWS[slot] };
  }
  const slot = team === 0 ? id - 8 : id - 20;
  const cols = team === 0 ? TEAM_A_RESERVE_COLS : TEAM_B_RESERVE_COLS;
  const col = centerCol ?? cols[(slot / RESERVE_ROWS.length) | 0];
  const row = RESERVE_ROWS[slot % RESERVE_ROWS.length];
  return { team, type: RESERVE_TYPES_BY_TEAM[team][slot % 12], cellX: col, cellY: row };
}

function createFieldAssets(landshipEnabled = true) {
  const assets = [];
  let id = 0;
  for (let team = 0; team < TEAM_COUNT; team++) {
    const spawnX = team === 0 ? TEAM_A_SPAWN_X : TEAM_B_SPAWN_X;
    for (let slot = 0; slot < SPAWN_ROWS.length; slot++) {
      assets.push(makeFieldAsset(id, SPAWN_TYPES[slot], team, spawnX, SPAWN_ROWS[slot]));
      id++;
    }
  }
  for (let team = 0; team < TEAM_COUNT; team++) {
    const cols = team === 0 ? TEAM_A_RESERVE_COLS : TEAM_B_RESERVE_COLS;
    let slot = 0;
    for (const col of cols) {
      for (const row of RESERVE_ROWS) {
        assets.push(makeFieldAsset(id, RESERVE_TYPES_BY_TEAM[team][slot % 12], team, col, row));
        id++;
        slot++;
      }
    }
  }
  // Q42: THE LANDSHIP — one neutral hull (id 32, team -1), spawned at
  // a rotation point on the CENTRE COLUMN (x untouched by rotation, so
  // the x-mirror is exact; north/south alternation rides the hashed
  // landship law in the reducer). Nobody owns it until someone climbs
  // in. rules.landship === false omits it (LANDSHIP=0 — the A-keyed
  // hunt's bisection switch, vault-precedent).
  if (landshipEnabled) {
    assets.push(makeFieldAsset(32, 9 /* UNIT_LANDSHIP */, -1,
      LANDSHIP_SPAWNS[0][0], LANDSHIP_SPAWNS[0][1]));
  }
  return assets;
}

// Relay sites along the corridor: west approach, two mid relays, east
// approach. 11C balance fix: the old single centre relay at x=63 was
// un-mirrorable on a 128 map (centre = 63.5) — team B's patrol landed ON
// it while A's mirror landed beside it, and B won the middle race in 5/5
// sim seeds. Four relays in exact mirror pairs (32<->95, 58<->69) give
// each side a natural mid anchor and put the fight at the seam.
// B2 (Q30 ruling 2026-07-31): sites carry a KIND personality — RADAR
// widens the owning team's sensors, DEPOT is a forward resupply point,
// FACTORY speeds the rebuild wave. Every site still COUNTS as a relay
// for capture/majority/bleed (ruling a: identity through effects, not
// exclusion — the pool-315 pacing math is untouched). Kinds come in
// MIRRORED PAIRS, like everything else on these maps.
const RELAY_CELLS = [
  { cellX: 32, cellY: 63, kind: 2 /* DEPOT — the near-base road pair */ },
  { cellX: 58, cellY: 63 },
  { cellX: 69, cellY: 63 },
  { cellX: 95, cellY: 63, kind: 2 },
  // Prompt-51 ruling (BF2 study): LATERAL pairs on the trail loops — the
  // corridor gains flanking objectives so a losing team can back-cap and
  // the front thins enough for standard runs to find their windows.
  // Appended so road-relay site ids 0-3 stay pinned.
  { cellX: 44, cellY: 40, kind: 1 /* RADAR — the north lateral pair */ },
  { cellX: 83, cellY: 40, kind: 1 },
  { cellX: 44, cellY: 86 },
  { cellX: 83, cellY: 86 },
  // Q39 vault: MACHINERY LANDED, LIVE PLACEMENT PULLED (2026-08-01).
  // The frontier pair (58<->69 @ row 40) was mirror-symmetric on paper
  // and CONVICTED by A/B battery as a ~15-pt team-B edge that survived
  // mirroring (ab_novault 51.3% A vs baseline 36% — the rearguard
  // precedent: a symmetric addition exciting an asymmetric mode).
  // The vault returns on a map that MEASURES fair; until then the
  // income pass + kind stay engine-supported, sandbox-tested only.
];

// 11M: per-profile layout — what differs between maps. Spawns and bases
// are shared (both maps use the same corridor-flank arrangement). Every
// entry MUST keep the mirror invariant: pairs at x and 127-x.
export const MAP_LAYOUTS = Object.freeze({
  frontier_corridor: Object.freeze({
    relayCells: RELAY_CELLS,
    standardHomes: [{ cellX: 14, cellY: 59 }, { cellX: 113, cellY: 59 }],
  }),
  riverline: Object.freeze({
    // Mirrored pairs north and south of the road (44<->83), plus the
    // BRIDGE pair at the central crossing (58<->69, prompt 25 ruling b):
    // the bridges are the contested heart of this map.
    relayCells: [
      { cellX: 44, cellY: 32 }, { cellX: 83, cellY: 32 },
      { cellX: 44, cellY: 95 }, { cellX: 83, cellY: 95 },
      { cellX: 58, cellY: 63 }, { cellX: 69, cellY: 63 },
    ],
    // Riverline pacing (prompt 136): the bridge pair IS the crossing —
    // a team owning EVERY heart relay has cut the enemy's river supply
    // and bleeds tickets even at an outer 3-3 split. Mirror pair by
    // construction (58<->69 under x'=127-x). NOTE: in AI-vs-AI wars this
    // is redundant by geometry (the enemy bridge relay is always the 4th
    // relay); it exists for the HUMAN mutual-crossing case (both sides
    // trade outer relays across the river).
    heartSiteIds: Object.freeze([4, 5]),
    // The measured stall (10 of 11 horn wars, 2026-08-02): both armies
    // sit on their own bank at 3-3 and nothing bleeds for 30 minutes.
    // When the war is JOINED (both teams own a relay) but NEITHER holds
    // a bleed majority, the river grinds BOTH pools on this cadence —
    // the standoff converts to a ticket ending decided by accumulated
    // wreck attrition. Undefined on other profiles = off.
    stalemateBleedTicks: 50,
    standardHomes: [{ cellX: 14, cellY: 59 }, { cellX: 113, cellY: 59 }],
  }),
  blackwood: Object.freeze({
    // 18A (specs/10 §3): ring corners + the DEEP-WOODS pairs — the
    // contested heart is off the road. 8 relays, ticket majority 5.
    relayCells: [
      { cellX: 36, cellY: 28 }, { cellX: 91, cellY: 28 },
      { cellX: 36, cellY: 99 }, { cellX: 91, cellY: 99 },
      // B2: the deep-woods pairs get the personalities — RADAR in the
      // north heart (fog is this map's soul), DEPOT in the south (fed
      // by the 18G logging roads).
      { cellX: 58, cellY: 45, kind: 1 }, { cellX: 69, cellY: 45, kind: 1 },
      { cellX: 58, cellY: 82, kind: 2 }, { cellX: 69, cellY: 82, kind: 2 },
    ],
    standardHomes: [{ cellX: 14, cellY: 59 }, { cellX: 113, cellY: 59 }],
  }),
  caldera: Object.freeze({
    // Item 40 (the circle map): a relay pair on each ring road and one
    // on the centre trail — 6 relays, majority 4. Every relay sits ON
    // an artery (18C law: objectives live where traffic goes).
    relayCells: [
      { cellX: 58, cellY: 30 }, { cellX: 69, cellY: 30 },
      { cellX: 58, cellY: 97 }, { cellX: 69, cellY: 97 },
      { cellX: 58, cellY: 63 }, { cellX: 69, cellY: 63 },
    ],
    standardHomes: [{ cellX: 14, cellY: 59 }, { cellX: 113, cellY: 59 }],
  }),
  sawtooth: Object.freeze({
    // 18B (specs/10 §4): canyon heart + a pair per outer lane. The mesa
    // gaps stay relay-free — pure chokes, held by presence not capture.
    // 6 relays, ticket majority 4.
    // 18C: the lane relays MOVED from the lane ends (y 20/107) to the
    // GAP EXITS (y 34/93). Measured cause of the horn-bound pacing: at
    // the lane ends they were never captured ONCE in any seed — no unit
    // ever came within CAPTURE_SEEK_CELLS (16), so no capturer was ever
    // designated, so max holding was 2 of 6 and the majority of 4 was
    // unreachable. At the gap exits every crossing unit designates one.
    relayCells: [
      { cellX: 58, cellY: 63 }, { cellX: 69, cellY: 63 },
      { cellX: 44, cellY: 34 }, { cellX: 83, cellY: 34 },
      { cellX: 44, cellY: 93 }, { cellX: 83, cellY: 93 },
    ],
    standardHomes: [{ cellX: 14, cellY: 59 }, { cellX: 113, cellY: 59 }],
  }),
});

function createSites(profileName = "frontier_corridor") {
  const cellsFor = MAP_LAYOUTS[profileName]?.relayCells ?? RELAY_CELLS;
  return cellsFor.map((pos, id) => ({
    id, type: 1 /* SITE_RELAY */, owner: -1 /* SITE_NEUTRAL */,
    kind: pos.kind ?? 0, // B2: 0 relay, 1 RADAR, 2 DEPOT, 3 FACTORY
    captureProgress: 0, capturingTeam: -1, // 11B countdown
    hp: 60, // 11F: SITE_HP_MAX (import cycle keeps this a literal)
    cellX: pos.cellX, cellY: pos.cellY,
  }));
}

function createBases() {
  const a = FRONTIER_CORRIDOR.teamABase;
  const b = FRONTIER_CORRIDOR.teamBBase;
  return [
    { team: 0, x: a.x, y: a.y, width: a.width, height: a.height },
    { team: 1, x: b.x, y: b.y, width: b.width, height: b.height },
  ];
}

// mapArg: profile name string (standard scenario with field assets),
// a prebuilt map object (empty sandbox for tests), or undefined (default profile).
// 13F (playtest 6.7 plumbing): session-tunable rules, hashed. DEFAULTS
// ARE TODAY'S CONSTANTS — passing nothing changes nothing. Difficulty
// presets wire in when the user ratifies numbers (night-2 clarification 3).
export const DEFAULT_RULES = Object.freeze({
  mpgMinOperable: 6, // Slow Manufacture triggers below this many operable
  mpgTicks: 900,     // ...and rebuilds on this cadence
  // 13H hybrid ticket bleed (prompt-51): relay majority drains the enemy
  // pool 1 ticket per bleed cadence; empty pool = loss; horn backstop.
  // 315 per the 2026-07-31 pool ladder (n=300 per rung, frontier, live
  // config): median 21.2 min — centre of the designer's 20-22 window —
  // 9% horn, 32% comebacks. 300 read 19.7 min (under), 330 read 22.2
  // (over); story metrics were FLAT across the whole ladder, so the
  // pool buys duration and horn risk only. Judged on story metrics per
  // the ruling; data in reports/sweeps/pool_*.csv + dev-log.
  ticketPool: 315,
  ticketBleedTicks: 20,  // 2 s per ticket at 10 Hz
  ticketMajority: 5,     // of the 8 frontier relays; >= half+1 either map
  // B1: what a wreck costs its owner, refunded when the wreck is
  // recovered. 0 restores the pre-B1 world (deaths are free).
  ticketPerDisable: 1,
  // B3: a full-cap hold this long accelerates the enemy's bleed (mercy),
  // and an empty pool waits while the losing side still has a play live
  // (overtime). Both tunable; overtime:false restores the hard cutoff.
  // POW arc: pre-placed captives per prison. The full ruling arc:
  // 2 (prompt 130, fairness in band) → 1 (Q59, pacing) → 0 (Q61,
  // prompt 133): even one lock kept the POW-era doctrine tempo
  // (28.5 min / 46% horn vs the classic 21.7/15) and fairness sat at
  // band-edge. THE CLASSIC TEMPO IS THE DEFAULT; POWS=2 on the
  // server is the designed HUMAN-SESSION flavour (organic scout
  // captures still populate compounds in every war regardless).
  powPreplaced: 0,
  mercyPoolFraction: 4,  // mercy engages at pool/4 left (25%)
  mercyMultiplier: 3,
  overtime: true,
});

// 13G (playtest 6.7 ruling): named difficulty presets over the session
// rules. "normal" IS DEFAULT_RULES — a test pins that identity so the
// default session can never drift. Easier = rebuild sooner and while
// stronger; harder = only a gutted team rebuilds, and slowly.
export const RULE_PRESETS = Object.freeze({
  easy: Object.freeze({ mpgMinOperable: 8, mpgTicks: 600, ticketPool: 400, ticketBleedTicks: 20, ticketMajority: 5, ticketPerDisable: 1, mercyPoolFraction: 4, mercyMultiplier: 3, overtime: true }),
  normal: DEFAULT_RULES,
  hard: Object.freeze({ mpgMinOperable: 4, mpgTicks: 1500, ticketPool: 250, ticketBleedTicks: 20, ticketMajority: 5, ticketPerDisable: 1, mercyPoolFraction: 4, mercyMultiplier: 3, overtime: true }),
});

// 13E-selector: the CLI and any menu must validate against the REAL
// registry, never a hand-copied list that silently rots.
export function mapProfileNames() {
  return Object.keys(MAP_PROFILES);
}

export function rulesForPreset(name) {
  const preset = RULE_PRESETS[name];
  if (!preset) {
    throw new RangeError(`unknown rules preset: ${name} (have: ${Object.keys(RULE_PRESETS).join(", ")})`);
  }
  return preset;
}

export function createInitialState(mapSeed, mapArg = "frontier_corridor", rules = null) {
  let map;
  let assets;
  let sites;
  let bases;
  let standards;
  if (typeof mapArg === "string") {
    const profile = MAP_PROFILES[mapArg];
    if (!profile) throw new RangeError(`unknown map profile: ${mapArg}`);
    map = profile(mapSeed >>> 0);
    assets = createFieldAssets(rules?.landship !== false);
    sites = createSites(typeof mapArg === "string" ? mapArg : "frontier_corridor");
    bases = createBases();
    standards = createStandards(
      MAP_LAYOUTS[typeof mapArg === "string" ? mapArg : "frontier_corridor"]?.standardHomes
    );
  } else if (mapArg && typeof mapArg === "object") {
    map = mapArg;
    assets = [];
    sites = [];
    bases = [];
    standards = [];
  } else {
    throw new RangeError("mapArg must be a profile name or map object");
  }

  // Asymmetric mode framework (Q32): the mission object is null in
  // every standard war and hashed only when live, so the 1A fixture
  // never notices (the bridges pattern). Convoy wars spawn NO
  // standards — a scored flag that cannot end the war is a lie on the
  // map.
  // Q31 × item-40 (the caldera conviction, specs/10 §4g): the raider's
  // clause on a RING is a stomp factory — the circle is one long rear
  // area nobody guards, so the Skimmer double-captures endlessly
  // (convicted 31.7% A / 9-min dominations; clause-off discriminator
  // read fair 20-minute wars). MAP-KEYED deactivation, the premium
  // pattern: the clause stays live everywhere the geometry can answer
  // it. Explicit rules.raiderClause always wins.
  const mergedRules = { ...DEFAULT_RULES, ...(rules ?? {}) };
  if (typeof mapArg === "string" && mapArg === "caldera" &&
      rules?.raiderClause === undefined) {
    mergedRules.raiderClause = false;
  }

  const mission = createMission(mergedRules, assets, bases, (t) => getUnitStats(t));
  if (mission?.kind === 1) standards = []; // convoy: no standards at all
  if (mission?.kind === 2) {
    // HEIST (Q52): only the DEFENDER keeps a standard — the Asset in
    // their vault. The attacker's plinth stands empty; canScore's
    // heist exception makes their side vacuously safe.
    standards = standards.filter((st) => st.team !== mission.attacker);
  }

  // Q42: the landship's FIRST berth alternates by seed parity (wars
  // rotate seeds deterministically, so servers alternate fairly); the
  // hashed law's spawnIdx points at the NEXT berth.
  const landshipHull = assets.find((a) => a.id === 32);
  if (landshipHull) {
    const first = landshipBerth(map, mapSeed & 1);
    landshipHull.x = cellToWorld(first[0]);
    landshipHull.y = cellToWorld(first[1]);
    landshipHull.targetX = landshipHull.x;
    landshipHull.targetY = landshipHull.y;
  }

  // POW arc: pre-placed captives start OP_CAPTIVE with their team set
  // (they have never joined — the lock must know whose seat it holds).
  const operators = createOperators();
  const powN = (rules?.powPreplaced ?? DEFAULT_RULES.powPreplaced) | 0;
  if (typeof mapArg === "string" && powN > 0) {
    for (const [prisonTeam, powIds] of Object.entries(PREPLACED_POWS)) {
      for (const id of powIds.slice(0, powN)) {
        operators[id].state = OP_CAPTIVE;
        operators[id].team = 1 - Number(prisonTeam);
      }
    }
  }
  return {
    tick: 0,
    mapSeed: mapSeed >>> 0,
    map,
    teamScores: [0, 0],
    operators,
    assets,
    sites,
    bases,
    standards, // 8A: physical Command Standards
    mapProfile: typeof mapArg === "string" ? mapArg : "frontier_corridor", // 11M
    rules: mergedRules, // 13F: hashed session rules (+ map laws above)
    tickets: [
      (rules?.ticketPool ?? DEFAULT_RULES.ticketPool),
      (rules?.ticketPool ?? DEFAULT_RULES.ticketPool),
    ], // 13H: per-team pools, hashed
    overtime: 0, // prompt 136: ticks an empty pool was held open (B3 cap)
    downed: [], // 9B: operators on foot
    manufacture: [0, 0], // 9D: Slow Manufacture timers per team
    salvage: [0, 0], // ruled 2026-07-31: recovered wrecks bank MPG-wave discounts
    // LAST CONVOY (ruled 2026-07-31): the losing team's endgame. One
    // per team per war; ids = the hulls in the field when it was called.
    convoy: [
      { active: 0, need: 0, done: 0, ids: [] },
      { active: 0, need: 0, done: 0, ids: [] },
    ],
    mines: [], // 9E: deployed mines
    nextMineId: 0,
    caltrops: [], // Q45: live chase-shaper patches
    nextCaltropId: 0,
    sandbags: [], // Q45/Q50: player-built cover (walls with hp)
    nextSandbagId: 0,
    drones: [], // 9G: anti-camping drones aloft
    nextDroneId: 0,
    // 13E: droppable crossings. EMPTY on every profile without them, so
    // the hash (and the 1A fixture) is untouched wherever bridges do not
    // exist — the same inertness the wall rule has.
    bridges: createBridges(typeof mapArg === "string" ? mapArg : "frontier_corridor"),
    // B6: the seed-scheduled neutral supply drop (own array, NOT a site
    // — a mid-war site would move the majority denominator; 13E lesson).
    drops: createDrops(mapSeed >>> 0),
    // POW arc slice 1: one prison per base, pre-loaded symmetrically
    // (the pre-placed enemy regents start OP_CAPTIVE — see below).
    prisons: createPrisons(bases, powN, map.width),
    // Asymmetric mode framework: null = standard war (never hashed).
    mission,
    // Q42: the landship respawn law — {respawnTicks (0 = alive),
    // spawnIdx (which rotation point the NEXT spawn uses)}. Hashed.
    landship: { respawnTicks: 0, spawnIdx: (mapSeed & 1) ^ 1 },
    // 3E: victory bookkeeping (all hashed).
    phase: 0, // PHASE_RUNNING
    winner: -1,
    winReason: 0, // WIN_NONE
    dominationTeam: -1,
    dominationTicks: 0,
    events: [],
  };
}
