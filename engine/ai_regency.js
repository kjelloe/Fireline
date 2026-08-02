// engine/ai_regency.js — deterministic AI Regency (1D fixed agents + 3C).
// Generates ordinary reducer commands; never touches state directly and uses
// neither wall-clock time nor randomness. Humans always resolve first in a
// tick. 3C adds: a fire doctrine (nearest team-visible enemy in range, only
// while in supply), and regency takeover of human operator slots whose
// connection dropped (the war keeps moving without them).

import { bridgeSpans, bridgeIntact, adjacentToBridge } from "./bridges.js";
import {
  OP_ABSENT, OP_ACTIVE, ASSET_IDLE, ASSET_MOVING, ASSET_DISABLED, ASSET_SALVAGED,
} from "./state.js";
import {
  CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER, CMD_FIRE_ORDER,
  CMD_TOW_ORDER, CMD_DEPLOY_MINE, CMD_CLEAR_MINE, CMD_PING, CMD_DEPLOY_CALTROPS,
  CMD_DEPLOY_HARDPOINT, CMD_UNDEPLOY,
} from "./commands.js";
import { mineAt, MINE_CLEAR_RADIUS_CELLS } from "./mines.js";
import { caltropAt } from "./caltrops.js";
import { GUARD_SENSE_CELLS } from "./prisons.js";
import { sampleCellX } from "../shared/fixedmath.js";
import { baseCentreCol } from "./state.js";

// Standards by TEAM lookup (heist mode fields ONE standard — the
// length-2 index pattern silently disabled every standard doctrine
// there).
const stdOf = (state, team) => state.standards.find((s) => s.team === team) ?? null;

// Q62 (prompt 133): the push CORRIDOR — mission attackers capture
// relays along the spine from their base to the objective ONLY (zero
// capturers starved the push of forward supply and cost convoy 17
// points of attacker rate; all-relays bled the posture dry). Pure
// integer point-to-segment test.
export const CORRIDOR_CELLS = 10;
function nearSegment(px, py, ax, ay, bx, by, r) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const dot = apx * abx + apy * aby;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0 || dot <= 0) return apx * apx + apy * apy <= r * r;
  if (dot >= len2) {
    const dx = px - bx, dy = py - by;
    return dx * dx + dy * dy <= r * r;
  }
  const cross = apx * aby - apy * abx;
  return cross * cross <= r * r * len2;
}
function missionObjectiveCell(state, attacker) {
  const m = state.mission;
  if (!m) return null;
  if (m.kind === 1) return [m.gateCellX, m.gateCellY];
  const std = stdOf(state, attacker === 0 ? 1 : 0);
  return std ? [sampleCellX(std.x, AI_W), worldToCellFloor(std.y)] : null;
}
function corridorRelay(state, team, site) {
  const home = state.bases.find((b) => b.team === team);
  const obj = missionObjectiveCell(state, team);
  if (!home || !obj) return false;
  return nearSegment(site.cellX, site.cellY,
    baseCentreCol(home), home.y + ((home.height / 2) | 0),
    obj[0], obj[1], CORRIDOR_CELLS);
}


// Boundary-parity law (specs/08 §7): every x-position DECISION floors
// through sampleCellX. Module-scoped width, refreshed at plan() entry
// — helpers below plan() run only inside a plan pass.
let AI_W = 128;
import { PING_COOLDOWN_TICKS } from "./pings.js";
import { CMD_TRANSFER_CARGO } from "./commands.js"; // 13B
import { computeVisible } from "./los.js";
import { routeWaypoints, nextWaypoint } from "./route_graph.js";
import { inFireRange } from "./combat.js";
import { inSupply } from "./supply.js";
import { getUnitStats } from "./units.js";
import { STD_AT_BASE, STD_CARRIED, STD_DROPPED } from "./standards.js";
import { CMD_REDEPLOY, CMD_CRAWL_ORDER } from "./commands.js";
import { downedFor, REDEPLOY_TICKS, CRAWL_RADIUS_CELLS } from "./downed.js";
import { MISSION_CONVOY, MISSION_HEIST, CONVOY_PING_TICKS } from "./mission.js";
import { towRejection, towedWreck } from "./recovery.js";
import { OP_DOWN } from "./state.js";
import { worldToCellFloor } from "../shared/fixedmath.js";

// Objective doctrine: since 9A only Command Carriers can take the enemy
// standard, the raider role goes to the first controlled operable carrier.

export const AI_OPERATOR_FIRST = 16;
export const AI_OPERATOR_COUNT = 16;

// One AI regent is permanently paired with a field asset. Operators 16-23 keep
// their original pairing with assets 0-7 (pinned by 1D); operators 24-27 crew
// team A reserves 8-11 and 28-31 crew team B reserves 20-23. The remaining
// reserves are garage stock for humans and regency takeovers.
const AGENTS = Object.freeze([
  { operatorId: 16, assetId: 0, team: 0 },
  { operatorId: 17, assetId: 1, team: 0 },
  { operatorId: 18, assetId: 2, team: 0 },
  { operatorId: 19, assetId: 3, team: 0 },
  { operatorId: 20, assetId: 4, team: 1 },
  { operatorId: 21, assetId: 5, team: 1 },
  { operatorId: 22, assetId: 6, team: 1 },
  { operatorId: 23, assetId: 7, team: 1 },
  { operatorId: 24, assetId: 8, team: 0 },
  { operatorId: 25, assetId: 9, team: 0 },
  { operatorId: 26, assetId: 10, team: 0 },
  { operatorId: 27, assetId: 11, team: 0 },
  { operatorId: 28, assetId: 20, team: 1 },
  { operatorId: 29, assetId: 21, team: 1 },
  { operatorId: 30, assetId: 22, team: 1 },
  { operatorId: 31, assetId: 23, team: 1 },
]);

// Legible doctrine: advance from both base areas toward the corridor, then
// patrol the centre. Team B's patrol crosses the centre relay, so AI wars
// contest supply the same way humans do.
// 11C: exact mirrors (x' = 127-x), each crossing its team's mid relay.
// 11M: patrols are per-map — riverline routes swing north and south
// through the bridge lines and past both relay pairs.
export const PATROLS = Object.freeze({
  frontier_corridor: Object.freeze({
    0: [[48, 56], [60, 56], [58, 63], [56, 70]],
    1: [[79, 56], [67, 56], [69, 63], [71, 70]],
    // 11V: light chassis (scout/bike) run the TRAILS — the flanking loops
    // at rows 40/86 that heavy hulls cross at rough speed. Exact mirrors.
    light0: [[30, 40], [60, 40], [60, 86], [30, 86]],
    light1: [[97, 40], [67, 40], [67, 86], [97, 86]],
  }),
  riverline: Object.freeze({
    0: [[44, 33], [52, 63], [44, 94], [36, 63]],
    1: [[83, 33], [75, 63], [83, 94], [91, 63]],
    // Riverline's main routes already ride the trail columns; the light
    // variant leans harder up and down them.
    light0: [[44, 33], [44, 60], [44, 94], [44, 66]],
    light1: [[83, 33], [83, 60], [83, 94], [83, 66]],
  }),
  blackwood: Object.freeze({
    // 18A: heavies work the road and the alley mouths toward the
    // deep-woods relays; lights run their side of the trail ring.
    // Exact mirrors (11C law).
    0: [[44, 63], [58, 52], [58, 75], [36, 63]],
    1: [[83, 63], [69, 52], [69, 75], [91, 63]],
    light0: [[36, 28], [58, 28], [58, 99], [36, 99]],
    light1: [[91, 28], [69, 28], [69, 99], [91, 99]],
  }),
  caldera: Object.freeze({
    // Item 40: heavies work the centre trail between the middle relays
    // and their near ring relay; lights RIDE THE RING. Exact mirrors.
    0: [[40, 63], [58, 56], [58, 30], [58, 70]],
    1: [[87, 63], [69, 56], [69, 30], [69, 70]],
    light0: [[14, 40], [58, 30], [58, 97], [14, 87]],
    light1: [[113, 40], [69, 30], [69, 97], [113, 87]],
  }),
  sawtooth: Object.freeze({
    // 18B: heavies duel in the canyon between the gap mouths; lights
    // cycle their side's outer relays through the gaps. Exact mirrors.
    // 18C: heavy patrols now REACH the enemy heart relay — the old table
    // stood off at 18 cells Manhattan, just past CAPTURE_SEEK_CELLS (16),
    // so no capturer was ever designated for it. Light patrols ride their
    // side's gaps between the two relocated lane relays.
    0: [[42, 63], [58, 56], [62, 63], [58, 70]],
    1: [[85, 63], [69, 56], [65, 63], [69, 70]],
    light0: [[44, 34], [42, 46], [44, 93], [42, 82]],
    light1: [[83, 34], [85, 46], [83, 93], [85, 82]],
  }),
});

function patrolTarget(agent, tick, profileName = "frontier_corridor", mirrored = false, light = false) {
  const set = PATROLS[profileName] ?? PATROLS.frontier_corridor;
  // 11P: in a reflected world each team patrols the OTHER side's routes —
  // legal because the tables are exact mirrors of each other (11C).
  const side = (agent.team === 0) !== mirrored ? 0 : 1;
  const patrol = (light ? set[`light${side}`] : null) ?? set[side];
  const phase = ((tick / 80) | 0) + (agent.assetId & 3);
  return patrol[phase % patrol.length];
}

function homeCellFor(state, team) {
  const base = state.bases.find((b) => b.team === team);
  if (!base) return null;
  return [baseCentreCol(base), base.y + ((base.height / 2) | 0)];
}

function isWreck(asset) {
  return asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED;
}

// 16B/prompt-54: does this map give Riverline Drive a surface — water
// OR trails? Cached per profile+seed; terrain is static within a war.
const runwayCache = new Map();
function mapHasRunway(state) {
  const key = `${state.mapProfile}:${state.mapSeed}`;
  if (runwayCache.has(key)) return runwayCache.get(key);
  let has = false;
  const cells = state.map?.cells;
  if (cells) {
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === 6 /* T_WATER */ || cells[i] === 5 /* T_PATH */) { has = true; break; }
    }
  }
  runwayCache.set(key, has);
  return has;
}

// Item 11 (playtest 7, ruled BOTH triggers): may the carrier raid NOW?
// Group attack: >=2 crewed COMBAT hulls (not the logistics train) within
// ESCORT_CELLS of the carrier. Sneak window: fewer than 2 enemy operable
// hulls near the carrier->standard track (sampled at the midpoint and the
// standard — cheap, deterministic, good enough for a window test).
export const ESCORT_CELLS = 6;
export const SNEAK_SCAN_CELLS = 12;
// Formation primitive (prompt 110 queue): a party ASSEMBLES at a rally
// cell before it ADVANCES, and the soft leader holds inside cohesion
// range of its escorts. Chasing a fast leader's live position never
// converged (the raid-party diagnosis: 2,478 dive ticks, zero holds,
// raiders dying solo at the wire).
export const FORM_UP_CELLS = 3;      // party counts as assembled within this of the rally
export const RAID_COHESION_CELLS = 4; // soft leader stays this close to an escort
// An empty wire is only a sneak window if the raider is already CLOSE.
// Guard count is measured 5 cells around the prison — at war start
// that quadrant is empty and both raiders solo-dived across the whole
// map from tick 2 (the trace: guards=0, dive=true, t=2). The route is
// the danger, not the wire.
export const SNEAK_DIVE_CELLS = 12;
// Approach lanes. Three designs measured before this one: a shared
// row (parties meet head-on at map centre and annihilate — traced at
// x≈64, t≈475, every war), a ±6 straddle (the compound-INTERIOR row
// wall-jams: team 1 sprang its people 3/3 seeds, team 0 never), and
// alternating time windows (parties die waiting at the rally — 2/5
// seeds raided). v4, the n=300 verdict on v3's +10/+6 team split: the
// shorter lane handed team 1 the whole POW game (28.3% A at POWS=2,
// ~5 pts of B edge in DEFAULT wars — organic captures put parties in
// 2 of 3 of them). ONE shared lane, same for both teams, is fair by
// construction; the old head-on-annihilation measurement predated
// fights-on-the-move and no longer reproduces.
export const RAID_LANE_ROWS = 8; // both teams — see fairness note above
export const RAID_TURN_IN_CELLS = 12;
function raidWindowOpen(state, carrier, visibleSet) {
  const cx = sampleCellX(carrier.x, AI_W);
  const cy = worldToCellFloor(carrier.y);
  let escorts = 0;
  for (const a of state.assets) {
    if (a.team !== carrier.team || a.id === carrier.id || isWreck(a)) continue;
    if (a.operatorId === -1) continue;
    const st = getUnitStats(a.type);
    if (st.canTow || st.canCarryStandard) continue; // the guns, not the train
    const d = Math.max(Math.abs(sampleCellX(a.x, AI_W) - cx), Math.abs(worldToCellFloor(a.y) - cy));
    if (d <= ESCORT_CELLS) escorts++;
    if (escorts >= 2) return true;
  }
  const std = stdOf(state, carrier.team === 0 ? 1 : 0);
  if (!std) return false; // heist defenders have no target to raid
  const sx = sampleCellX(std.x, AI_W);
  const sy = worldToCellFloor(std.y);
  const mx = (cx + sx) >> 1;
  const my = (cy + sy) >> 1;
  let defenders = 0;
  for (const e of state.assets) {
    if (e.team === carrier.team || isWreck(e)) continue;
    const ex = sampleCellX(e.x, AI_W);
    const ey = worldToCellFloor(e.y);
    const nearMid = Math.max(Math.abs(ex - mx), Math.abs(ey - my)) <= SNEAK_SCAN_CELLS;
    const nearStd = Math.max(Math.abs(ex - sx), Math.abs(ey - sy)) <= SNEAK_SCAN_CELLS;
    if (nearMid || nearStd) defenders++;
    if (defenders >= 2) return false;
  }
  return true; // thin defenses — the opportune moment
}

function nearestUnownedRelay(state, asset) {
  const cellX = sampleCellX(asset.x, AI_W);
  const cellY = worldToCellFloor(asset.y);
  let best = null;
  let bestDist = Infinity;
  // Tie-break MUST commute with the mirror (the 13C 72/28 lesson: lowest
  // site id ties drifted BOTH teams' capture-seek toward the west relays
  // — ids follow layout order — and the tow economy compounded the side
  // that fought beside its own base). Ladder: same side of the axis as
  // the asset, then farther off-axis, then id (only same-rank leftovers).
  const mySide = Math.sign(2 * cellX - 127) || 1;
  const beats = (site, cur) => {
    if (cur === null) return true;
    const sSide = Math.sign(2 * site.cellX - 127) === mySide;
    const cSide = Math.sign(2 * cur.cellX - 127) === mySide;
    if (sSide !== cSide) return sSide;
    const sxr = Math.abs(2 * site.cellX - 127);
    const cxr = Math.abs(2 * cur.cellX - 127);
    if (sxr !== cxr) return sxr > cxr;
    const syr = Math.abs(2 * site.cellY - 127);
    const cyr = Math.abs(2 * cur.cellY - 127);
    if (syr !== cyr) return syr > cyr;
    return site.id < cur.id;
  };
  for (const site of state.sites) {
    if (site.owner === asset.team) continue;
    const dx = Math.abs(site.cellX - cellX);
    const dy = Math.abs(site.cellY - cellY);
    const dist = dx + dy;
    if (dist < bestDist || (dist === bestDist && beats(site, best))) {
      best = site;
      bestDist = dist;
    }
  }
  return best;
}

function pickFireTarget(state, asset, visibleSet) {
  let best = null;
  let bestKey = null;
  // Q2d (prompt 16): an enemy CARRYING a standard is the priority target —
  // the ruled counter to the mutual-carry standoff. Rank: carrier-of-standard
  // first, then nearest, ties on lowest id.
  const carryingIds = new Set(
    state.standards.filter((st) => st.carrierAssetId !== -1).map((st) => st.carrierAssetId)
  );
  let bestCarries = false;
  for (const enemy of state.assets) {
    if (enemy.team === asset.team || isWreck(enemy)) continue;
    // Q42: the NEUTRAL landship threatens nobody — shooting an empty
    // fortress is wasted ammo and a wasted prize. Crewed, its team is
    // 0/1 and it's a target like any other.
    if (enemy.team === -1) continue;
    if (!visibleSet.has(enemy.id)) continue;
    if (!inFireRange(asset, enemy)) continue;
    const carries = carryingIds.has(enemy.id);
    const dx = enemy.x - asset.x;
    const dy = enemy.y - asset.y;
    const key = dx * dx + dy * dy;
    const better =
      best === null ||
      (carries && !bestCarries) ||
      (carries === bestCarries && (key < bestKey || (key === bestKey && enemy.id < best.id)));
    if (better) {
      best = enemy;
      bestKey = key;
      bestCarries = carries;
    }
  }
  return best;
}

// 11C: how far off-plan an agent will divert to flip a nearby relay.
export const CAPTURE_SEEK_CELLS = 16;
// Q31 seat-swap: how long a unique may earn nothing before its regent
// gives up on it (2.5 min - two patrol legs, one full errand).
export const EARN_WINDOW_TICKS = 1500;

// 11D (Q11): tanks fortify ground this close to an owned relay (never the
// site cell itself — that's protected); trucks clear marked mines they pass.
export const MINE_FORTIFY_CELLS = 3;
export const HARDPOINT_STATION_CELLS = 3; // 16B: Sentinel anchors this close to an owned relay
// 11D (Q16): regents signal sparingly — one ping per seat per 30 s.
export const AI_PING_INTERVAL_TICKS = 300;

// 11E (Q5): how far a truck/carrier will divert for a rescue errand.
export const RESCUE_SEEK_CELLS = 24;

export const AI_EASY = 0;
export const AI_NORMAL = 1;
export const AI_HARD = 2;

export class AIRegency {
  constructor(options = {}) {
    this.fixedAgents = options.fixedAgents === false ? [] : AGENTS;
    this.mirrored = options.mirrored === true; // 11P: world-reflection sims
    this.regented = new Set(); // human operator slots under takeover (3C)
    // 6D: easy fires every other tick; hard swaps patrols for relay pushes.
    this.difficulty = options.difficulty ?? AI_NORMAL;
    // 16B: unique-chassis crewing — DEFAULT ON since prompt-54: the
    // Riverline-Drive trail affinity closed the swap gate (Sentinel-side
    // 60.2% -> 54.5%, in band). The full evidence chain lives in dev-log
    // (standing fortress 78/19 -> reactive tune -> water/trail crewing
    // gate -> no-squat Sentinel -> trail affinity). UNIQUES=0 disables
    // for A/B sweeps.
    this.uniqueCrewing = options.uniqueCrewing !== false;
    // Q71 TRIAL (prompt 145, the Q18 GO): tick-parity COMMAND order —
    // on odd ticks team B's commands apply first (stable within each
    // team, so per-operator sequences hold). The suspected first-strike
    // chirality: A's regents (lower operator ids) always enqueued first,
    // so A's shots resolved before B's answers, every tick, all war.
    // OFF by default until the trial batteries speak (ORDERPARITY=1).
    this.orderParity = options.orderParity === true;
    // A/B kill-switch (bisection only, never a shipped config): skip
    // the prison raid-party doctrine entirely.
    this.raidPartyEnabled = options.raidParty !== false;
    this.alarmResponseEnabled = options.alarmResponse !== false; // A/B only
    // Q31 SEAT-SWAP DOCTRINE (ruled 2026-07-31): "the punishment for a
    // bad unique is surviving in it" — the sawtooth conviction showed a
    // regent imprisoned all war in a Skimmer that earned nothing. A
    // regent crewing a UNIQUE whose seat gained no recognition across a
    // whole earn window abandons it for a real hull, and the unique is
    // BENCHED for the rest of the war (else the crewing doctrine would
    // walk somebody straight back in).
    this.earnCheck = new Map(); // operatorId -> {score, tick}
    this.benched = new Set();   // asset ids given up as not earning
  }

  assume(operatorId) {
    this.regented.add(operatorId);
  }

  release(operatorId) {
    this.regented.delete(operatorId);
  }

  // 13E-2: which span should THIS tube drop, or -1.
  //
  // Conditions, all deliberate:
  //  - siege chassis only (the reducer enforces it too; this keeps the
  //    AI from emitting orders it knows will be refused),
  //  - the span must still be standing and in range,
  //  - the team must be LOSING this crossing - measured as the enemy
  //    holding more relays on the far side of the river than we do.
  //    Demolition is a momentum-breaker, not an opening move.
  //  - ONE besieger per span: the lowest operator id already in range
  //    owns it, the capture-seek designation pattern. Without this every
  //    tube in the war shells the same crossing and nothing else happens.
  pickBridgeToBreach(state, asset) {
    const stats = getUnitStats(asset.type);
    if (!stats.siege) return -1;
    const spans = bridgeSpans(state.mapProfile);
    if (!spans.length) return -1;
    const cellX = sampleCellX(asset.x, AI_W);
    const foe = asset.team === 0 ? 1 : 0;
    // Are we behind on the far bank? Count relays by side of the river.
    const mid = 63;
    const weAreEast = cellX > mid;
    let ours = 0;
    let theirs = 0;
    for (const site of state.sites) {
      const farSide = weAreEast ? site.cellX < mid : site.cellX > mid;
      if (!farSide) continue;
      if (site.owner === asset.team) ours += 1;
      else if (site.owner === foe) theirs += 1;
    }
    if (theirs <= ours) return -1; // winning or level: leave the road open

    let best = -1;
    for (let id = 0; id < spans.length; id++) {
      const b = (state.bridges ?? []).find((x) => x.id === id);
      if (!b || !bridgeIntact(b)) continue;
      const geom = spans[id];
      const pos = {
        x: ((geom.cols[0] + geom.cols[1]) >> 1) * 256,
        y: ((geom.rows[0] + geom.rows[1]) >> 1) * 256,
      };
      if (!inFireRange(asset, pos)) continue;
      // Designation: the lowest-id friendly siege tube in range owns it.
      let owner = asset.operatorId;
      for (const other of state.assets) {
        if (other.team !== asset.team || other.operatorId === -1 || isWreck(other)) continue;
        if (!getUnitStats(other.type).siege) continue;
        if (!inFireRange(other, pos)) continue;
        if (other.operatorId < owner) owner = other.operatorId;
      }
      if (owner !== asset.operatorId) continue;
      if (best === -1) best = id;
    }
    return best;
  }

  plan(state) {
    AI_W = state.map.width; // boundary-parity law (specs/08 §7)
    const commands = [];
    const visibleByTeam = [computeVisible(state, 0), computeVisible(state, 1)];

    // Claim fixed AI operator slots exactly once.
    for (const agent of this.fixedAgents) {
      if (state.operators[agent.operatorId].state === OP_ABSENT) {
        commands.push({ type: CMD_JOIN_OPERATOR, operatorId: agent.operatorId, team: agent.team });
        commands.push({ type: CMD_SELECT_ASSET, operatorId: agent.operatorId, assetId: agent.assetId, confirm: true });
      }
    }

    // Command doctrine for every AI-controlled operator, stable ascending order.
    const controlled = new Map(); // operatorId -> fixed agent | null (regented)
    for (const agent of this.fixedAgents) controlled.set(agent.operatorId, agent);
    for (const id of [...this.regented].sort((a, b) => a - b)) {
      if (!controlled.has(id)) controlled.set(id, null);
    }

    // Per-team designated roles, computed fresh every tick from live state
    // (both rules found by backend sims: a global recoverer pick left one team
    // unable to recover; a dead scout left a team unable to raid again).
    // recoverer: lowest controlled operator driving an operable team asset.
    // raider: the team scout if alive, else the highest such operator's asset.
    const recovererFor = { 0: -1, 1: -1 };
    const recovererSpeed = { 0: -1, 1: -1 };
    const raiderFor = { 0: -1, 1: -1 };
    for (const [operatorId, agent] of [...controlled.entries()].sort((a, b) => a[0] - b[0])) {
      const op = state.operators[operatorId];
      if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
      const a = state.assets[op.assetId];
      if (!a || a.operatorId !== operatorId || isWreck(a)) continue;
      // 11V: the recoverer is the FASTEST controlled seat (ties: lowest
      // operator) — a crewed bike naturally becomes the standard courier.
      const speed = getUnitStats(a.type).speed;
      const cur = recovererFor[a.team];
      if (cur === -1 || speed > (recovererSpeed[a.team] ?? -1)) {
        recovererFor[a.team] = operatorId;
        recovererSpeed[a.team] = speed;
      }
      if (raiderFor[a.team] === -1 && getUnitStats(a.type).canCarryStandard) {
        raiderFor[a.team] = a.id; // first operable controlled carrier raids
      }
      // Q70 POSTSCRIPT: the AI scout-raider (always-dive getaway) was
      // TRIED and REVERTED same night — the battery read attacker 1%
      // (from 8): a solo dive into the garrison is a suicide doctrine
      // that bleeds the attacker's elimination-path wins. The CARRY
      // rule stays for humans (standards.js); the AI raids by carrier
      // until siege prep (the named missing lever) gets its GO.
    }

    // 11C capture-seek roles: ONE designated capturer per (team, unowned
    // relay) — the nearest controlled operable asset, ties on lowest
    // operator id. Sim-verified: letting everyone divert piled both teams
    // onto one contested flag where nobody could fire (out of supply) and
    // four of five seeds froze at 0-0.
    const capturerFor = new Map(); // `${team}:${siteId}` -> operatorId
    for (const site of state.sites) {
      for (const team of [0, 1]) {
        if (site.owner === team) continue;
        // MODE WARS (Q62): the ATTACKER captures along the PUSH
        // CORRIDOR only — the supply spine to the objective. Zero
        // capturers starved the push (convoy 27/19 -> 10% under the
        // blanket gate); all-relays bled the posture (escNear 0-1).
        if (state.mission && team === state.mission.attacker &&
            !corridorRelay(state, team, site)) continue;
        let bestOp = -1;
        let bestDist = Infinity;
        // 16B residue fix: the Sentinel is no CAPTURER — a 150hp hull
        // parked on flags dominated the ticket era (anchor time 2-4x the
        // Skimmer's). It defends relays via the reactive hardpoint
        // doctrine instead; capture errands go to hulls that can leave.
        for (const [operatorId] of [...controlled.entries()].sort((a, b) => a[0] - b[0])) {
          const op = state.operators[operatorId];
          if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
          const a = state.assets[op.assetId];
          if (!a || a.team !== team || a.operatorId !== operatorId || isWreck(a)) continue;
          const st16 = getUnitStats(a.type);
          if (!st16.canCapture) continue; // 11R: bikes can't be capturers
          if (st16.deployable) continue;  // 16B: the Sentinel defends, never squats
          const dist = Math.abs(site.cellX - sampleCellX(a.x, AI_W)) +
                       Math.abs(site.cellY - worldToCellFloor(a.y));
          if (dist < bestDist) {
            bestDist = dist;
            bestOp = operatorId;
          }
        }
        if (bestOp !== -1 && bestDist <= CAPTURE_SEEK_CELLS) {
          capturerFor.set(`${team}:${site.id}`, bestOp);
        }
      }
    }

    // B6 drop-securer: while the neutral supply drop is live, ONE
    // designated securer per team (the capture-seek pattern — everyone
    // diverting is how wars froze at 0-0). Wider leash than a relay:
    // the drop is announced map-wide and worth crossing for.
    const securerFor = new Map(); // team -> operatorId
    for (const drop of state.drops ?? []) {
      if (drop.securedBy !== -1 || state.tick < drop.activateTick) continue;
      const dropX = state.map.width >> 1;
      for (const team of [0, 1]) {
        let bestOp = -1;
        let bestDist = Infinity;
        for (const [operatorId] of [...controlled.entries()].sort((a, b) => a[0] - b[0])) {
          const op = state.operators[operatorId];
          if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
          const a = state.assets[op.assetId];
          if (!a || a.team !== team || a.operatorId !== operatorId || isWreck(a)) continue;
          const st = getUnitStats(a.type);
          if (!st.canCapture || st.deployable) continue; // same bench as flags
          const dist = Math.abs(dropX - sampleCellX(a.x, AI_W)) +
                       Math.abs(drop.cellY - worldToCellFloor(a.y));
          if (dist < bestDist) {
            bestDist = dist;
            bestOp = operatorId;
          }
        }
        if (bestOp !== -1 && bestDist <= CAPTURE_SEEK_CELLS + 8) {
          securerFor.set(team, bestOp);
        }
      }
    }

    // POW arc: ONE designated prison raider per team while the ENEMY
    // prison holds our people (pre-placed captives make this a day-one
    // errand). The SCOUT is the POW specialist (specs/12 Q36) — the
    // nearest controlled scout rides for the wire, whatever the
    // distance (a deep raid is the intended shape).
    // Slice 3: a coordinated RAID PARTY. The scout stages short of the
    // enemy base until the window opens — two escorts at hand, or a
    // sneak window (a thinly guarded wire) — then dives. One lone
    // scout at a defended prison measured 0 raids in 5 wars; parties
    // are how the mission actually completes.
    const prisonRaiderFor = new Map(); // team -> {opId, prison, dive, stage}
    for (const prison of state.prisons ?? []) {
      if (this.raidPartyEnabled === false) break; // A/B kill-switch
      if (prison.pows.length === 0) continue;
      const team = prison.team === 0 ? 1 : 0; // the prisoners' own team raids
      // Scouts preferred (the specialist), but Q37's raid is "any
      // raiding vehicle" — and the pre-placed captives ARE scout crews
      // half the time (locking ops 30/31 uncrews asset 22, a scout), so
      // a scout-only rule starved the mission to 0 raids. Any free
      // combat hull will hold the wire.
      let bestOp = -1;
      let bestScore = Infinity;
      for (const [operatorId] of [...controlled.entries()].sort((a, b) => a[0] - b[0])) {
        const op = state.operators[operatorId];
        if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
        const a = state.assets[op.assetId];
        if (!a || a.team !== team || a.operatorId !== operatorId || isWreck(a)) continue;
        const st = getUnitStats(a.type);
        if (st.canTow || st.canCarryStandard || st.indirect || st.deployable) continue;
        const dist = Math.abs(prison.cellX - sampleCellX(a.x, AI_W)) +
                     Math.abs(prison.cellY - worldToCellFloor(a.y));
        // FUEL LIVENESS (the t4000-t16000 finding): a fuel-dead hull 21
        // cells out kept winning the designation by pure proximity and
        // froze the mission for 12,000 ticks. A raider must be able to
        // DRIVE there: ~10 fuel/cell covers the worst chassis, plus a
        // fighting reserve.
        if (a.fuel < dist * 10 + 300) continue;
        const score = dist + (a.type === 1 ? 0 : 200); // scouts outrank at any range
        if (score < bestScore) { bestScore = score; bestOp = operatorId; }
      }
      if (bestOp === -1) {
        // Telemetry must record FAILURE too — a stale success entry
        // masqueraded as a frozen raider for a whole diagnosis round.
        (this.raidDebug ??= {})[team] = { tick: state.tick, opId: -1, reason: "no eligible raider" };
        continue;
      }
      // Guard count = the prison QUADRANT only (radius 5). Counting the
      // whole base garrison (radius 12 covered it, plus MPG waves spawn
      // there) meant the sneak window never opened — measured 1/5 raids.
      let guards = 0;
      for (const e of state.assets) {
        if (e.team !== prison.team || isWreck(e) || e.operatorId === -1) continue;
        if (Math.max(Math.abs(sampleCellX(e.x, AI_W) - prison.cellX),
                     Math.abs(worldToCellFloor(e.y) - prison.cellY)) <= 5) guards++;
      }
      // The rally cell sits near OWN lines — 12 cells out from the home
      // base toward the target, on the prison's row. The first version
      // staged at prison−24 (deep in the enemy half): the scout parked
      // there alone for ~1000 ticks while its tanks crossed, and died
      // waiting, every time. Assemble where it's safe, advance together.
      // Geometry-derived (base centre + prison), so it commutes with
      // the mirror.
      const homeBase = state.bases.find((b) => b.team === team);
      const bx = homeBase ? baseCentreCol(homeBase) : prison.cellX;
      const sx = prison.cellX > bx ? 1 : prison.cellX < bx ? -1 : 0;
      const laneY = Math.min(state.map.height - 1, prison.cellY + RAID_LANE_ROWS);
      const stage = [
        Math.abs(prison.cellX - bx) > 12 ? bx + sx * 12 : prison.cellX,
        laneY,
      ];
      prisonRaiderFor.set(team, { opId: bestOp, prison, guards, stage, escorts: [] });
    }

    // Item 11 escort ASSEMBLY (the active half of "group attack"): when
    // the raider wants to launch but the window is closed, the two
    // nearest idle-line combat seats (not capturers, not the logistics
    // train, not tubes) are designated escorts and converge on the
    // carrier; while the raid runs they ride along. Passive
    // wait-for-luck windows never opened in sims (patrol phases scatter
    // hulls by design) — assembly is what makes raids happen at all.
    const escortFor = new Map(); // operatorId -> carrier asset id
    const capturerOps = new Set(capturerFor.values());
    for (const team of [0, 1]) {
      const raiderId = raiderFor[team];
      if (raiderId === -1) continue;
      const carrier = state.assets[raiderId];
      if (!carrier || isWreck(carrier)) continue;
      const eStd = stdOf(state, team === 0 ? 1 : 0);
      if (!eStd) continue;
      const wantRaid = eStd.status === STD_AT_BASE || eStd.status === STD_DROPPED;
      const raiding = eStd.status === STD_CARRIED && eStd.carrierAssetId === raiderId;
      if (!wantRaid && !raiding) continue;
      const ccx = sampleCellX(carrier.x, AI_W);
      const ccy = worldToCellFloor(carrier.y);
      const candidates = [];
      for (const [opId] of controlled) {
        const op = state.operators[opId];
        if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
        const a = state.assets[op.assetId];
        if (!a || a.team !== team || a.operatorId !== opId || isWreck(a)) continue;
        const st = getUnitStats(a.type);
        if (st.canTow || st.canCarryStandard || st.indirect) continue;
        if (capturerOps.has(opId)) continue; // capturers keep capturing
        if (prisonRaiderFor.get(team)?.opId === opId) continue; // the raider has a mission
        const d = Math.max(Math.abs(sampleCellX(a.x, AI_W) - ccx),
                           Math.abs(worldToCellFloor(a.y) - ccy));
        candidates.push([d, opId]);
      }
      candidates.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      // HEIST (prompt 141): the attacker fields NO standard — nothing
      // at home to defend, so the WHOLE free line rides with the raid
      // (the convoy's last-kilometre law, applied from t=0). Two
      // escorts was the meat grinder: carriers died solo at the centre
      // choke (esc=0-1 in every trace) while the attacker out-fielded
      // the defence 14v7 and never once concentrated it.
      const escortN = state.mission?.kind === MISSION_HEIST &&
        team === state.mission.attacker ? candidates.length : 2;
      for (const [, opId] of candidates.slice(0, escortN)) escortFor.set(opId, raiderId);
    }

    // CONVOY ESCORT mission doctrine. Attackers: the two nearest free
    // combat seats ride herd on the convoy truck through the SAME
    // tight-follow law the standard raid uses (escortFor — the truck
    // is slow, so chase-the-leader converges here where it never could
    // on a scout). Defenders: two interceptors converge on the last
    // radio ping (AI memory refreshed on the reducer's own cadence —
    // the same intel the mode grants everyone, no fog cheating in
    // between).
    const interceptorOps = new Set();
    const vaultGuardOps = new Set();
    let wreckerOp = -1;
    if (state.mission?.kind === MISSION_CONVOY) {
      const m = state.mission;
      const truck = state.assets[m.convoyId];
      if (truck && !isWreck(truck)) {
        const tcx = sampleCellX(truck.x, AI_W);
        const tcy = worldToCellFloor(truck.y);
        const cands = [];
        for (const [opId] of controlled) {
          if (escortFor.has(opId) || prisonRaiderFor.get(m.attacker)?.opId === opId) continue;
          const op = state.operators[opId];
          if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
          const a = state.assets[op.assetId];
          if (!a || a.team !== m.attacker || a.operatorId !== opId || isWreck(a)) continue;
          const st = getUnitStats(a.type);
          if (st.canTow || st.canCarryStandard || st.indirect) continue;
          const d = Math.max(Math.abs(sampleCellX(a.x, AI_W) - tcx),
                             Math.abs(worldToCellFloor(a.y) - tcy)) +
                    (capturerOps.has(opId) ? 100 : 0); // capturers last-resort
          cands.push([d, opId]);
        }
        cands.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        // THE LAST KILOMETRE: near the gate the war concentrates — the
        // defence is densest at its own base, and a 2-tank detail
        // reached an equilibrium 13-40 cells short in every stopped
        // war (timer 7500 AND 9000 — more time changed nothing). Close
        // to the gate, the whole free line rides with the convoy.
        const distToGate = Math.max(Math.abs(tcx - m.gateCellX),
                                    Math.abs(tcy - m.gateCellY));
        const escortN = distToGate <= 30 ? 4 : 2;
        for (const [, opId] of cands.slice(0, escortN)) escortFor.set(opId, m.convoyId);
        if (state.tick % CONVOY_PING_TICKS === 0 || !this.convoyIntel) {
          this.convoyIntel = [tcx, tcy];
        }
        // Defender interceptors: two nearest combat seats hunt the ping.
        const defender = m.attacker === 0 ? 1 : 0;
        const hunters = [];
        for (const [opId] of controlled) {
          if (escortFor.has(opId) || prisonRaiderFor.get(defender)?.opId === opId) continue;
          const op = state.operators[opId];
          if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
          const a = state.assets[op.assetId];
          if (!a || a.team !== defender || a.operatorId !== opId || isWreck(a)) continue;
          const st = getUnitStats(a.type);
          if (st.canTow || st.canCarryStandard || st.indirect) continue;
          if (capturerOps.has(opId)) continue; // defence holds its ground game
          const d = Math.max(Math.abs(sampleCellX(a.x, AI_W) - this.convoyIntel[0]),
                             Math.abs(worldToCellFloor(a.y) - this.convoyIntel[1]));
          hunters.push([d, opId]);
        }
        hunters.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        for (const [, opId] of hunters.slice(0, 2)) interceptorOps.add(opId);
      }
      // WRECKER designation: the convoy is DOWN — the nearest other
      // attacker truck drops everything (resupply included) and rides
      // to the wreck. Standing beside it runs the restart clock.
      if (truck && truck.state === 2 /* ASSET_DISABLED */ && truck.towedBy === -1) {
        const wx = sampleCellX(truck.x, AI_W);
        const wy = worldToCellFloor(truck.y);
        let best = -1;
        let bestD = Infinity;
        for (const [opId] of controlled) {
          const op = state.operators[opId];
          if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
          const a = state.assets[op.assetId];
          if (!a || a.team !== m.attacker || a.operatorId !== opId || isWreck(a)) continue;
          if (a.id === m.convoyId || !getUnitStats(a.type).canTow) continue;
          const d = Math.max(Math.abs(sampleCellX(a.x, AI_W) - wx),
                             Math.abs(worldToCellFloor(a.y) - wy));
          if (d < bestD) { bestD = d; best = opId; }
        }
        wreckerOp = best;
      }
    }

    // Q52 HEIST doctrine (prompt 141: this block was NESTED INSIDE the
    // convoy branch since it landed — mission.kind can't be 1 and 2 at
    // once, so NONE of it ever ran; the trace showed it: no guard cap,
    // no interceptors, carriers soloing the centre choke all war).
    // Defenders: THREE hulls hold the Asset, the rest fight forward;
    // while the Asset is CARRIED the radio betrays the thief and two
    // free seats hunt the last ping.
    const siegeOps = new Set(); // Q72: the heist siege battery
    if (state.mission?.kind === MISSION_HEIST) {
      const mh = state.mission;
      const defender = mh.attacker === 0 ? 1 : 0;
      const std = stdOf(state, defender);
      // Q72 SIEGE PREP (prompt 151): the attacker's indirect tubes are
      // the SIEGE BATTERY — they stand ~9 cells off the vault (outside
      // the garrison's 5-cell guns, inside their own 12) and shell the
      // guards the escorts spot; the hold-short carrier already dives
      // the moment the vault thins. SIEGE=0 (rules.heistSiege=false)
      // is the A/B switch.
      if (std && state.rules?.heistSiege !== false) {
        for (const [opId] of controlled) {
          const op = state.operators[opId];
          if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
          const a = state.assets[op.assetId];
          if (!a || a.team !== mh.attacker || a.operatorId !== opId || isWreck(a)) continue;
          if (!getUnitStats(a.type).indirect) continue;
          siegeOps.add(opId);
        }
      }
      if (std) {
        const sx = sampleCellX(std.x, AI_W);
        const sy = worldToCellFloor(std.y);
        const gs = [];
        for (const [opId] of controlled) {
          const op = state.operators[opId];
          if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
          const a = state.assets[op.assetId];
          if (!a || a.team !== defender || a.operatorId !== opId || isWreck(a)) continue;
          const st = getUnitStats(a.type);
          if (st.canTow || st.canCarryStandard || st.indirect) continue;
          const d = Math.max(Math.abs(sampleCellX(a.x, AI_W) - sx),
                             Math.abs(worldToCellFloor(a.y) - sy));
          gs.push([d, opId]);
        }
        gs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        for (const [, opId] of gs.slice(0, 3)) vaultGuardOps.add(opId);
        if (std.status === 1 /* STD_CARRIED */) {
          if (state.tick % CONVOY_PING_TICKS === 0 || !this.heistIntel) {
            this.heistIntel = [sx, sy];
          }
          const hunters = [];
          for (const [opId] of controlled) {
            if (vaultGuardOps.has(opId) || escortFor.has(opId)) continue;
            const op = state.operators[opId];
            if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
            const a = state.assets[op.assetId];
            if (!a || a.team !== defender || a.operatorId !== opId || isWreck(a)) continue;
            const st = getUnitStats(a.type);
            if (st.canTow || st.canCarryStandard || st.indirect) continue;
            const d = Math.max(Math.abs(sampleCellX(a.x, AI_W) - this.heistIntel[0]),
                               Math.abs(worldToCellFloor(a.y) - this.heistIntel[1]));
            hunters.push([d, opId]);
          }
          hunters.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
          for (const [, opId] of hunters.slice(0, 2)) interceptorOps.add(opId);
        } else {
          this.heistIntel = null;
        }
      }
    }

    // FORMATION (the group-movement primitive, v1 consumer: the prison
    // raid party). Two nearest free combat seats join the raider's
    // PARTY (ops already escorting the carrier keep that duty; the
    // standard outranks). The party has a persistent phase in AI
    // memory: ASSEMBLE — everyone rides to the rally cell (the stage,
    // 24 cells short of the wire) — then ADVANCE once all living
    // members stand within FORM_UP_CELLS of it. Escorts lead the
    // advance; the raider holds inside RAID_COHESION_CELLS of one.
    // Solo dives only through a truly empty wire (guards === 0) — the
    // old `guards < 2` window is the documented meat grinder.
    for (const team of [0, 1]) {
      if (!prisonRaiderFor.has(team) && this.raidParty?.[team]) delete this.raidParty[team];
    }
    // ALARM RESPONSE (specs/12 Q38): the watchman's shout means
    // someone comes home. An enemy hull near OUR stocked compound
    // pulls the nearest free combat seat back to the wire — the
    // response the alarm exists to trigger.
    const prisonDefenderFor = new Map(); // team -> opId
    for (const prison of state.prisons ?? []) {
      if (this.alarmResponseEnabled === false) break; // A/B kill-switch
      if (prison.pows.length === 0) continue; // an empty compound guards itself
      const threatened = state.assets.some((a) =>
        a.team !== prison.team && a.operatorId !== -1 && !isWreck(a) &&
        Math.max(Math.abs(sampleCellX(a.x, AI_W) - prison.cellX),
                 Math.abs(worldToCellFloor(a.y) - prison.cellY)) <= GUARD_SENSE_CELLS + 4);
      if (!threatened) continue;
      let best = -1;
      let bestD = Infinity;
      for (const [opId] of controlled) {
        if (prisonRaiderFor.get(prison.team)?.opId === opId ||
            prisonRaiderFor.get(prison.team)?.escorts?.includes(opId)) continue;
        if (escortFor.has(opId) || interceptorOps.has(opId)) continue;
        const op = state.operators[opId];
        if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
        const a = state.assets[op.assetId];
        if (!a || a.team !== prison.team || a.operatorId !== opId || isWreck(a)) continue;
        const st = getUnitStats(a.type);
        if (st.canTow || st.canCarryStandard || st.indirect) continue;
        const d = Math.max(Math.abs(sampleCellX(a.x, AI_W) - prison.cellX),
                           Math.abs(worldToCellFloor(a.y) - prison.cellY));
        if (d < bestD) { bestD = d; best = opId; }
      }
      if (best !== -1) prisonDefenderFor.set(prison.team, best);
    }
    for (const [team, rp] of prisonRaiderFor) {
      const raiderAsset = state.assets[state.operators[rp.opId]?.assetId];
      if (!raiderAsset || isWreck(raiderAsset)) { prisonRaiderFor.delete(team); continue; }
      const rcx = sampleCellX(raiderAsset.x, AI_W);
      const rcy = worldToCellFloor(raiderAsset.y);
      // Seat scarcity is the real starvation (measured: esc=0 in
      // 11,905 of 12,000 plan passes): with POWS locking 4 seats a
      // team runs ~6 regents, and the carrier raid doctrine held both
      // tanks as its standing escorts. So: carrier escorts are
      // poachable while the standard raid is SPECULATIVE (enemy
      // standard safe at home), locked while it is LIVE (carried).
      // Capturers are last-resort. Rank: free hulls, +50 carrier
      // escorts, +100 capturers.
      const eStd = stdOf(state, team === 0 ? 1 : 0);
      const stdRaidLive = eStd ? eStd.status === STD_CARRIED : false;
      const cands = [];
      for (const [opId] of controlled) {
        if (opId === rp.opId) continue;
        if (escortFor.has(opId) && stdRaidLive) continue;
        const op = state.operators[opId];
        if (op.state !== OP_ACTIVE || op.assetId === -1) continue;
        const a = state.assets[op.assetId];
        if (!a || a.team !== team || a.operatorId !== opId || isWreck(a)) continue;
        const st = getUnitStats(a.type);
        if (st.canTow || st.canCarryStandard || st.indirect) continue;
        const d = Math.max(Math.abs(sampleCellX(a.x, AI_W) - rcx),
                           Math.abs(worldToCellFloor(a.y) - rcy)) +
                  (escortFor.has(opId) ? 50 : 0) +
                  (capturerOps.has(opId) ? 100 : 0);
        cands.push([d, opId]);
      }
      cands.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      rp.escorts = cands.slice(0, 2).map(([, opId]) => opId);
      // Persistent phase (AI memory, unhashed — recomputed state stays
      // in the plan pass; only the assemble/advance latch survives).
      const mem = (this.raidParty ??= {});
      let ph = mem[team];
      if (!ph || ph.raiderOp !== rp.opId) ph = mem[team] = { raiderOp: rp.opId, phase: 0 };
      const memberCells = [[rcx, rcy]];
      for (const opId of rp.escorts) {
        const a = state.assets[state.operators[opId].assetId];
        memberCells.push([sampleCellX(a.x, AI_W), worldToCellFloor(a.y)]);
      }
      if (ph.phase === 0 && rp.escorts.length >= 2 && memberCells.every(([cx, cy]) =>
        Math.max(Math.abs(cx - rp.stage[0]), Math.abs(cy - rp.stage[1])) <= FORM_UP_CELLS)) {
        ph.phase = 1; // formed up — advance together
      }
      // Escorts all gone before the clock started → re-form. Committed
      // clocks (raidTicks > 0) press on: flapping at the wire wastes
      // the whole approach.
      if (ph.phase === 1 && rp.escorts.length === 0 &&
          rp.prison.raidTicks === 0 && rp.guards > 0) {
        ph.phase = 0;
      }
      rp.phase = ph.phase;
      const raiderDist = Math.max(Math.abs(rcx - rp.prison.cellX),
                                  Math.abs(rcy - rp.prison.cellY));
      rp.sneak = rp.guards === 0 && raiderDist <= SNEAK_DIVE_CELLS;
      rp.dive = rp.prison.raidTicks > 0 || ph.phase === 1 || rp.sneak;
      // Telemetry for doctrine work: the decision per plan, readable
      // by probes via server.ai.raidDebug — records phase now too.
      (this.raidDebug ??= {})[team] = {
        tick: state.tick, opId: rp.opId, assetId: raiderAsset.id,
        dive: rp.dive, phase: ph.phase, escorts: rp.escorts.length, guards: rp.guards,
        raiderCell: [rcx, rcy], hp: raiderAsset.hp,
        stage: rp.stage, escortCells: memberCells.slice(1),
      };
    }

    // Question 18 fix: commands used to resolve in ascending operator order
    // every tick, so team A's seats always struck first — a ~6-point edge
    // that survived full world reflection AND faction-swapping (nightly
    // census, 1500 wars). The lead team now alternates by tick parity;
    // within a team, ascending operator id keeps iteration stable.
    const leadTeam = state.tick & 1;
    const emitOrder = [...controlled.entries()].sort((a, b) => {
      const ta = state.operators[a[0]].team === leadTeam ? 0 : 1;
      const tb = state.operators[b[0]].team === leadTeam ? 0 : 1;
      return ta - tb || a[0] - b[0];
    });
    for (const [operatorId, agent] of emitOrder) {
      const operator = state.operators[operatorId];

      // 9B down-management: redeploy once the timer allows; after redeploy or
      // delivery, re-crew — fixed agents retake their paired asset when it is
      // operable and free; regented seats take the lowest free operable asset.
      if (operator.state === OP_DOWN) {
        const down = downedFor(state, operatorId);
        // A freed POW cannot self-redeploy (the carrier ride IS the
        // rescue) — but lying at the wire re-secures them in 600 ticks.
        // Freed prisoners CRAWL for home: it breaks the re-secure
        // radius and moves the pickup toward friendly lines.
        if (down && down.freedPow === 1) {
          const home = state.bases.find((b) => b.team === operator.team);
          if (home) {
            // Crawl is capped at CRAWL_RADIUS_CELLS per order ("move
            // minimally to cover") — a cross-map target is rejected.
            // Short LEGS toward home instead: 3 cells at a time, one
            // axis then the other, re-issued as each leg completes.
            const hx = baseCentreCol(home);
            const hy = home.y + ((home.height / 2) | 0);
            const cx = sampleCellX(down.x, AI_W);
            const cy = worldToCellFloor(down.y);
            const dx = Math.max(-CRAWL_RADIUS_CELLS, Math.min(CRAWL_RADIUS_CELLS, hx - cx));
            const legX = cx + dx;
            const legY = cy + Math.max(-(CRAWL_RADIUS_CELLS - Math.abs(dx)),
              Math.min(CRAWL_RADIUS_CELLS - Math.abs(dx), hy - cy));
            const tx = sampleCellX(down.targetX, AI_W);
            const ty = worldToCellFloor(down.targetY);
            if ((legX !== cx || legY !== cy) && (tx !== legX || ty !== legY)) {
              commands.push({ type: CMD_CRAWL_ORDER, operatorId, targetCellX: legX, targetCellY: legY });
            }
          }
          continue;
        }
        if (down && down.downTicks >= REDEPLOY_TICKS) {
          commands.push({ type: CMD_REDEPLOY, operatorId });
        }
        continue; // aboard a carrier or waiting out the timer
      }
      if (operator.state === OP_ACTIVE && operator.assetId === -1) {
        let pick = null;
        const team = operator.team;
        // Q1 (prompt 16): "AI may crew free assets when a ROLE is unfilled."
        // TEAM-wide check (a human raiding fills the role too): no crewed
        // operable carrier anywhere on the team → ANY free AI seat grabs a
        // spare carrier before its default pick.
        const carrierCrewed = state.assets.some((a) =>
          a.team === team && a.operatorId !== -1 && !isWreck(a) &&
          getUnitStats(a.type).canCarryStandard);
        const roleCarrier = !carrierCrewed
          ? state.assets.find((a) =>
              a.team === team && a.operatorId === -1 && !isWreck(a) &&
              getUnitStats(a.type).canCarryStandard)
          : null;
        // 11V courier: our standard lies in the open and nobody fast is on
        // it — grab the garage bike (fastest return in the war).
        let roleBike = null;
        if (!roleCarrier && stdOf(state, team)?.status === STD_DROPPED &&
            (recovererSpeed[team] ?? -1) < 72) {
          roleBike = state.assets.find((a) =>
            a.team === team && a.operatorId === -1 && !isWreck(a) &&
            getUnitStats(a.type).speed >= 72);
        }
        // 11V fire support: no crewed indirect tube on the team — crew a
        // free mortar/artillery (replacement-artillery doctrine).
        let roleTube = null;
        if (!roleCarrier && !roleBike) {
          const tubeCrewed = state.assets.some((a) =>
            a.team === team && a.operatorId !== -1 && !isWreck(a) &&
            getUnitStats(a.type).indirect);
          if (!tubeCrewed) {
            roleTube = state.assets.find((a) =>
              a.team === team && a.operatorId === -1 && !isWreck(a) &&
              getUnitStats(a.type).indirect);
          }
        }
        // 13C tow lifeline: routed roads deliver the whole team — truck
        // included — into the centre fight, and a dead truck used to end
        // the team's tow economy for the war (300-sweep: tows 85 -> 0).
        // Same shape as the tube rule: no crewed tower anywhere on the
        // team + a free truck in the garage -> crew it.
        let roleTruck = null;
        if (!roleCarrier && !roleBike && !roleTube) {
          const towCrewed = state.assets.some((a) =>
            a.team === team && a.operatorId !== -1 && !isWreck(a) &&
            getUnitStats(a.type).canTow);
          if (!towCrewed) {
            roleTruck = state.assets.find((a) =>
              a.team === team && a.operatorId === -1 && !isWreck(a) &&
              getUnitStats(a.type).canTow);
          }
        }
        // 16B faction identity: the unique chassis must not rot in the
        // garage (sim probe: the Sentinel sat uncrewed for entire wars,
        // so its anchor doctrine never fired). No crewed unique on the
        // team and one is free -> take it before the default pick.
        // Carrier/courier/tube roles stay senior — those win wars.
        let roleUnique = null;
        if (this.uniqueCrewing && !roleCarrier && !roleBike && !roleTube) {
          // 16B residue fix (probe-led), amended by prompt-54: the
          // airboat crews only where Riverline Drive has a surface to
          // run — WATER or TRAILS. (The first cut gated on water alone,
          // which locked the Skimmer out of frontier and made the swap
          // gate structurally unpassable.)
          const hasWater = mapHasRunway(state);
          const isUnique = (a) => {
            const st = getUnitStats(a.type);
            if (st.amphibious === true) return hasWater;
            return st.deployable === true;
          };
          const uniqueCrewed = state.assets.some((a) =>
            a.team === team && a.operatorId !== -1 && !isWreck(a) && isUnique(a));
          if (!uniqueCrewed) {
            roleUnique = state.assets.find((a) =>
              a.team === team && a.operatorId === -1 && !isWreck(a) && isUnique(a) &&
              !this.benched.has(a.id)); // Q31: a benched unique stays benched
          }
        }
        if (roleCarrier) {
          pick = roleCarrier.id;
        } else if (roleBike) {
          pick = roleBike.id;
        } else if (roleTube) {
          pick = roleTube.id;
        } else if (roleTruck) {
          pick = roleTruck.id;
        } else if (agent && state.assets[agent.assetId] &&
                   state.assets[agent.assetId].operatorId === -1 &&
                   !isWreck(state.assets[agent.assetId])) {
          pick = agent.assetId; // a fixed agent's own seat outranks the unique
        } else if (roleUnique) {
          pick = roleUnique.id;
        } else if (!agent) {
          const free = state.assets.find((a) =>
            a.team === team &&
            a.operatorId === -1 && !isWreck(a));
          if (free) pick = free.id;
        }
        if (pick !== null) {
          commands.push({ type: CMD_SELECT_ASSET, operatorId, assetId: pick, confirm: true });
        }
        continue;
      }
      if (operator.state !== OP_ACTIVE || operator.assetId === -1) continue;
      const asset = state.assets[operator.assetId];
      // Q56 (prompt 151, DEFAULT OFF — rules.landshipAI === true
      // enables; the owner's playtest feel decides the flip): an
      // OPPORTUNISTIC landship claim. A regent driving a LIGHT hull
      // (bike/scout) within 12 cells of the uncrewed neutral fortress
      // steps across — select IS the capture (Q42), and the light hull
      // it abandons costs the line little. Condition is pure geometry
      // + chassis, so it commutes with the mirror.
      if (state.rules?.landshipAI === true) {
        const ls = state.assets[32];
        if (ls && ls.team === -1 && ls.operatorId === -1 && !isWreck(ls) &&
            (asset.type === 1 || asset.type === 5)) {
          const d = Math.max(Math.abs(sampleCellX(asset.x, AI_W) - sampleCellX(ls.x, AI_W)),
                             Math.abs(worldToCellFloor(asset.y) - worldToCellFloor(ls.y)));
          if (d <= 12) {
            commands.push({ type: CMD_SELECT_ASSET, operatorId, assetId: 32, confirm: true });
            continue;
          }
        }
      }
      // The AI never evicts humans or drives assets it does not operate.
      if (!asset || asset.operatorId !== operatorId || isWreck(asset)) continue;

      // Q31 SEAT-SWAP: a regent in a UNIQUE that earned NOTHING across a
      // full earn window abandons it for a free real hull and benches
      // the unique for the war. Humans are never touched (this loop is
      // regents only), and a unique that IS earning keeps its crew.
      {
        const st31 = getUnitStats(asset.type);
        if (st31.amphibious === true || st31.deployable === true) {
          const mark = this.earnCheck.get(operatorId);
          if (!mark || mark.assetId !== asset.id) {
            this.earnCheck.set(operatorId, { assetId: asset.id, score: operator.score, tick: state.tick });
          } else if (state.tick - mark.tick >= EARN_WINDOW_TICKS) {
            if (operator.score === mark.score) {
              const hull = state.assets.find((a) =>
                a.team === operator.team && a.operatorId === -1 && !isWreck(a) &&
                !getUnitStats(a.type).amphibious && !getUnitStats(a.type).deployable);
              if (hull) {
                this.benched.add(asset.id);
                this.earnCheck.delete(operatorId);
                commands.push({ type: CMD_SELECT_ASSET, operatorId, assetId: hull.id, confirm: true });
                continue;
              }
            }
            this.earnCheck.set(operatorId, { assetId: asset.id, score: operator.score, tick: state.tick });
          }
        }
      }

      // A raid-party member FIGHTS ON THE MOVE: firing is legal while
      // MOVING, and the fire doctrine's `continue` was pinning whole
      // parties at their rally in endless roadside firefights (measured:
      // 29,662 advance ticks, zero arrivals, seed 2026). The member
      // shoots AND falls through to the formation movement below.
      const partyNow = prisonRaiderFor.get(asset.team);
      const fightsMoving = ((!!partyNow && (asset.prisoner ?? -1) === -1 &&
        (partyNow.opId === operatorId || partyNow.escorts.includes(operatorId))) ||
        // Mission-war ATTACKERS fight on the move too — the fire
        // doctrine's continue pinned whole postures in place (heist:
        // escNear 0-1 all war, carrier crossing alone; the exact
        // starvation the raid party had before this law).
        (state.mission != null && asset.team === state.mission.attacker &&
         !getUnitStats(asset.type).indirect));

      // Q45 chase-shaper doctrine (BEFORE the fire doctrine — a mauled
      // runner's escape kit outranks its peashooter): pursued at ≤ half
      // hull with clean ground underfoot, strew the road. Delay the
      // pursuit, never punish it; the drop works on the move.
      {
        const st0 = getUnitStats(asset.type);
        if ((st0.caltrops ?? 0) > 0 && (asset.caltropsLeft ?? 0) > 0 &&
            asset.hp * 2 <= st0.hp) {
          const cx0 = sampleCellX(asset.x, AI_W);
          const cy0 = worldToCellFloor(asset.y);
          if (!caltropAt(state, cx0, cy0) && state.assets.some((e) =>
            e.team !== asset.team && e.operatorId !== -1 && !isWreck(e) &&
            Math.max(Math.abs(sampleCellX(e.x, AI_W) - cx0),
                     Math.abs(worldToCellFloor(e.y) - cy0)) <= 5)) {
            commands.push({ type: CMD_DEPLOY_CALTROPS, operatorId });
            continue;
          }
        }
      }
      // Fire doctrine: engage the nearest visible enemy in range when the
      // gun is loaded (8E). Easy regents observe a duty cycle: they only
      // engage during the first half of every double-reload window (6D).
      const reload = getUnitStats(asset.type).reloadTicks;
      const dutyOpen = this.difficulty !== AI_EASY ||
        state.tick % (2 * reload) < reload;
      if (dutyOpen && asset.reloadTimer === 0 && asset.ammo > 0 && inSupply(state, asset)) {
        // Q14 (prompt 16): a drone stinging THIS asset gets swatted first —
        // cheap shot, ends the pestering. Indirect tubes can't track it.
        if (!getUnitStats(asset.type).indirect) {
          const pest = state.drones.find(
            (d) => d.targetAssetId === asset.id && inFireRange(asset, d)
          );
          if (pest) {
            commands.push({ type: CMD_FIRE_ORDER, operatorId, targetDroneId: pest.id });
            continue;
          }
        }
        const target = pickFireTarget(state, asset, visibleByTeam[asset.team]);
        if (target) {
          commands.push({ type: CMD_FIRE_ORDER, operatorId, targetAssetId: target.id });
          if (!fightsMoving) continue;
        }
        // 13E-2 SIEGE: with no hull to shoot, a siege tube may drop a
        // bridge — but only when its side is LOSING the crossing, so
        // demolition reads as "break their momentum", not vandalism.
        // ONE besieger per span (the capture-seek designation pattern),
        // or every tube in the war shells the same crossing.
        const bridgeTarget = this.pickBridgeToBreach(state, asset);
        if (bridgeTarget !== -1) {
          commands.push({ type: CMD_FIRE_ORDER, operatorId, targetBridgeId: bridgeTarget });
          continue;
        }
      }

      // 11D alive-world doctrine (Q11/Q16) — the world acts even with one
      // human present. All state-driven and deterministic.
      const cellX0 = sampleCellX(asset.x, AI_W);
      const cellY0 = worldToCellFloor(asset.y);
      const stats = getUnitStats(asset.type);
      // Trucks defuse marked enemy mines they stand next to.
      if (stats.canClearMines) {
        const mine = state.mines.find((m) =>
          m.team !== asset.team && m.marked === 1 &&
          Math.max(Math.abs(m.cellX - cellX0), Math.abs(m.cellY - cellY0)) <= MINE_CLEAR_RADIUS_CELLS);
        if (mine) {
          commands.push({ type: CMD_CLEAR_MINE, operatorId, mineId: mine.id });
          continue;
        }
      }
      // Tanks fortify: idle near an owned relay (off the protected site
      // cell, outside bases), rack loaded, ground clean -> lay a mine.
      if (stats.canMine && asset.minesLeft > 0 && asset.state === ASSET_IDLE) {
        const nearOwned = state.sites.some((site) =>
          site.owner === asset.team &&
          !(site.cellX === cellX0 && site.cellY === cellY0) &&
          Math.max(Math.abs(site.cellX - cellX0), Math.abs(site.cellY - cellY0)) <= MINE_FORTIFY_CELLS);
        const inAnyBase = state.bases.some((b) =>
          cellX0 >= b.x && cellX0 < b.x + b.width && cellY0 >= b.y && cellY0 < b.y + b.height);
        if (nearOwned && !inAnyBase && !mineAt(state, cellX0, cellY0)) {
          commands.push({ type: CMD_DEPLOY_MINE, operatorId });
          continue;
        }
        // Standing ON the site it just captured: step one cell south to
        // legal ground so the fortify rule can fire next tick.
        const onOwnSite = state.sites.some((site) =>
          site.owner === asset.team && site.cellX === cellX0 && site.cellY === cellY0);
        if (onOwnSite) {
          commands.push({
            type: CMD_MOVE_ORDER, operatorId, targetCellX: cellX0, targetCellY: cellY0 + 1,
          });
          continue;
        }
      }
      // 16B Sentinel doctrine (12B unique, unblocked by the 12D fairness
      // gate): the hardpoint is a REACTIVE fortress, not a standing one.
      // First cut deployed on every owned relay permanently and swept
      // 78/19 on frontier — area denial with no Outlier mirror. Now it
      // deploys only when anchored near an owned site AND the team SEES
      // an enemy inside the deployed reach; threat gone (or anchor lost,
      // or a capture errand elsewhere) -> stow and roll. Fire doctrine
      // above stays first: a deployed Sentinel keeps shooting.
      if (stats.deployable && asset.deployTimer === 0) {
        const near = (site) =>
          Math.max(Math.abs(site.cellX - cellX0), Math.abs(site.cellY - cellY0)) <= HARDPOINT_STATION_CELLS;
        const anchored = state.sites.some((site) => site.owner === asset.team && near(site));
        const reach = stats.deployedRange ?? 0;
        const threatNear = state.assets.some((e) =>
          e.team !== asset.team && e.team !== -1 && !isWreck(e) &&
          visibleByTeam[asset.team].has(e.id) &&
          Math.abs(e.x - asset.x) <= reach && Math.abs(e.y - asset.y) <= reach);
        let capturerElsewhere = false;
        for (const [key, op] of capturerFor) {
          if (op !== operatorId) continue;
          const site = state.sites[Number(key.split(":")[1])];
          if (site && !near(site)) { capturerElsewhere = true; break; }
        }
        if (asset.deployed === 0 && asset.state === ASSET_IDLE &&
            anchored && threatNear && !capturerElsewhere) {
          commands.push({ type: CMD_DEPLOY_HARDPOINT, operatorId });
          continue;
        }
        if (asset.deployed === 1 && (!anchored || !threatNear || capturerElsewhere)) {
          commands.push({ type: CMD_UNDEPLOY, operatorId });
          continue;
        }
        // Deployed and staying: guns already handled above; movement
        // doctrine below would only emit orders the reducer rejects.
        if (asset.deployed === 1) continue;
      }
      // Regents ping, sparingly (Q16): the raider calls for escort while
      // carrying; the recoverer announces its run; scouts flag marked mines.
      if (state.tick - operator.lastPingTick >= AI_PING_INTERVAL_TICKS) {
        let ping = null;
        {
          const enemyStd = stdOf(state, asset.team === 0 ? 1 : 0);
          const ownStd = stdOf(state, asset.team);
          if (enemyStd && enemyStd.status === STD_CARRIED && enemyStd.carrierAssetId === asset.id) {
            ping = { kind: "need_escort" };
          } else if (ownStd && ownStd.status === STD_DROPPED && operatorId === recovererFor[asset.team]) {
            ping = {
              kind: "recovery_in_progress",
              targetCellX: sampleCellX(ownStd.x, AI_W), targetCellY: worldToCellFloor(ownStd.y),
            };
          }
        }
        if (!ping && asset.type === 1) {
          const marked = state.mines.find((m) =>
            m.team !== asset.team && m.marked === 1 &&
            Math.max(Math.abs(m.cellX - cellX0), Math.abs(m.cellY - cellY0)) <= 8);
          if (marked) {
            ping = { kind: "mines_detected", targetCellX: marked.cellX, targetCellY: marked.cellY };
          }
        }
        if (ping) {
          commands.push({ type: CMD_PING, operatorId, ...ping });
          // pinging is free: fall through to movement in the same tick
        }
      }

      // Movement doctrine, in priority order:
      //   1. Standard carrier heads home to score.
      //   2. Team's lowest controlled asset recovers a dropped own standard.
      //   3. The designated raider (scout) goes for the grounded enemy standard.
      //   4. Fixed agents patrol (hard difficulty pushes relays); regented
      //      assets seek the nearest unowned relay.
      // Item 11 abort (pre-gate — a mid-raid carrier is MOVING): a raider
      // en route WITHOUT the standard whose window closed breaks off and
      // rallies home instead of soloing into the guns.
      if (asset.id === raiderFor[asset.team] && asset.state === ASSET_MOVING &&
          stdOf(state, asset.team === 0 ? 1 : 0)) {
        const eStd = stdOf(state, asset.team === 0 ? 1 : 0);
        const carryingIt = eStd.status === STD_CARRIED && eStd.carrierAssetId === asset.id;
        const boundForStd = Math.max(
          Math.abs(asset.targetX - eStd.x), Math.abs(asset.targetY - eStd.y)) < 1024;
        if (!carryingIt && boundForStd &&
            !raidWindowOpen(state, asset, visibleByTeam[asset.team])) {
          // Escorts still inbound (within 2x escort range): HOLD position
          // and let them close — full retreat thrashed the raid to death.
          const cx0 = sampleCellX(asset.x, AI_W);
          const cy0 = worldToCellFloor(asset.y);
          let inbound = 0;
          for (const a of state.assets) {
            if (a.team !== asset.team || a.id === asset.id || isWreck(a)) continue;
            if (a.operatorId === -1) continue;
            const st = getUnitStats(a.type);
            if (st.canTow || st.canCarryStandard) continue;
            const d = Math.max(Math.abs(sampleCellX(a.x, AI_W) - cx0),
                               Math.abs(worldToCellFloor(a.y) - cy0));
            if (d <= ESCORT_CELLS * 2) inbound++;
          }
          const rally = inbound >= 2 ? [cx0, cy0] : homeCellFor(state, asset.team);
          if (rally) {
            commands.push({
              type: CMD_MOVE_ORDER, operatorId,
              targetCellX: rally[0], targetCellY: rally[1],
            });
            continue;
          }
        }
      }
      // FORMATION movement (pre-gate — members re-target while moving,
      // stale rendezvous cells are how the chase version failed). One
      // law for the whole party:
      //   assemble → everyone rides to the rally cell;
      //   advance  → escorts LEAD straight at the objective; the soft
      //              leader presses only inside RAID_COHESION_CELLS of
      //              a living escort, else it closes on the nearest
      //              escort instead of outrunning its armour.
      // A raider in custody is exempt — the capture pays at the prison
      // gate and the homing law (post-gate) owns that trip.
      {
        const rp = prisonRaiderFor.get(asset.team);
        const partyRole = rp && (asset.prisoner ?? -1) === -1
          ? (rp.opId === operatorId ? 1 : rp.escorts.includes(operatorId) ? 2 : 0)
          : 0;
        if (partyRole !== 0) {
          const myCx = sampleCellX(asset.x, AI_W);
          const myCy = worldToCellFloor(asset.y);
          // In-lane until the final stretch, then turn onto the wire.
          const goal = Math.abs(myCx - rp.prison.cellX) <= RAID_TURN_IN_CELLS
            ? [rp.prison.cellX, rp.prison.cellY]
            : [rp.prison.cellX, rp.stage[1]];
          let desired = null;
          if (rp.phase !== 1) {
            desired = rp.dive ? goal : rp.stage;
          } else if (partyRole === 2) {
            desired = goal;
          } else {
            // The leader: hold cohesion with the nearest living escort.
            let nearest = null;
            let nd = Infinity;
            for (const opId of rp.escorts) {
              const e = state.assets[state.operators[opId].assetId];
              const d = Math.max(Math.abs(sampleCellX(e.x, AI_W) - myCx),
                                 Math.abs(worldToCellFloor(e.y) - myCy));
              if (d < nd) { nd = d; nearest = e; }
            }
            if (rp.prison.raidTicks > 0 || rp.sneak || nearest === null || nd <= RAID_COHESION_CELLS) {
              desired = goal;
            } else {
              desired = [sampleCellX(nearest.x, AI_W), worldToCellFloor(nearest.y)];
            }
          }
          // Raw moves, not route-graph legs: waypoint re-issue from a
          // pre-gate block livelocked the party (the leg target flaps
          // as the route recomputes mid-leg — 26-30k advance ticks,
          // zero arrivals, zero deaths). The lane row IS the road here.
          if (desired && (myCx !== desired[0] || myCy !== desired[1])) {
            const stale = Math.max(
              Math.abs(sampleCellX(asset.targetX, AI_W) - desired[0]),
              Math.abs(worldToCellFloor(asset.targetY) - desired[1])) > 2;
            if (asset.state === ASSET_IDLE || stale) {
              commands.push({
                type: CMD_MOVE_ORDER, operatorId,
                targetCellX: desired[0], targetCellY: desired[1],
              });
            }
            continue;
          }
          if (desired) continue; // standing on the goal cell — the dwell is the job
        }
      }
      // Item 11 escorts follow TIGHT (pre-gate): an escort whose carrier
      // has drifted >2 cells from its current destination re-targets NOW,
      // not on arrival at a stale rendezvous — lag is how the first
      // implementation got every raider killed alone.
      if (escortFor.has(operatorId) && prisonRaiderFor.get(asset.team)?.opId !== operatorId) {
        const c = state.assets[escortFor.get(operatorId)];
        if (c && !isWreck(c)) {
          const ecx = sampleCellX(c.x, AI_W);
          const ecy = worldToCellFloor(c.y);
          const myCx = sampleCellX(asset.x, AI_W);
          const myCy = worldToCellFloor(asset.y);
          const gap = Math.max(Math.abs(myCx - ecx), Math.abs(myCy - ecy));
          const destStale = Math.max(
            Math.abs(sampleCellX(asset.targetX, AI_W) - ecx),
            Math.abs(worldToCellFloor(asset.targetY) - ecy)) > 2;
          if (gap > 3 && (asset.state === ASSET_IDLE || destStale)) {
            commands.push({
              type: CMD_MOVE_ORDER, operatorId, targetCellX: ecx, targetCellY: ecy,
            });
            continue;
          }
        }
      }
      // The designated WRECKER (pre-gate): beats every errand — the
      // mission clock is burning while the convoy lies on its side.
      if (operatorId === wreckerOp) {
        const cv = state.assets[state.mission.convoyId];
        if (cv) {
          const wx = sampleCellX(cv.x, AI_W);
          const wy = worldToCellFloor(cv.y);
          const myCx = sampleCellX(asset.x, AI_W);
          const myCy = worldToCellFloor(asset.y);
          if (Math.max(Math.abs(myCx - wx), Math.abs(myCy - wy)) > 1) {
            const stale = Math.max(
              Math.abs(sampleCellX(asset.targetX, AI_W) - wx),
              Math.abs(worldToCellFloor(asset.targetY) - wy)) > 2;
            if (asset.state === ASSET_IDLE || stale) {
              commands.push({
                type: CMD_MOVE_ORDER, operatorId, targetCellX: wx, targetCellY: wy,
              });
            }
          } else if (asset.state === ASSET_MOVING) {
            commands.push({
              type: CMD_MOVE_ORDER, operatorId,
              targetCellX: sampleCellX(asset.x, AI_W), targetCellY: worldToCellFloor(asset.y),
            });
          }
          continue;
        }
      }
      // CONVOY driver law (pre-gate — the truck is usually MOVING when
      // this matters): it rolls only with armour alongside; unescorted
      // it STOPS and waits (the designer's "moves only when allies are
      // nearby"). Escorts converging is what restarts it.
      if (state.mission?.kind === MISSION_CONVOY &&
          state.mission.convoyId === asset.id && asset.state === ASSET_MOVING) {
        const cx0 = sampleCellX(asset.x, AI_W);
        const cy0 = worldToCellFloor(asset.y);
        // THE DASH: inside the last dozen cells the convoy charges the
        // gate, escorts or none — probes stalled at 9-13 cells forever
        // because the terminal wall-fight kept killing the escorts and
        // the hold law kept parking the truck.
        const dash = Math.max(Math.abs(cx0 - state.mission.gateCellX),
                              Math.abs(cy0 - state.mission.gateCellY)) <= 12;
        const guarded = dash || state.assets.some((e) =>
          e.team === asset.team && e.id !== asset.id && e.operatorId !== -1 &&
          !isWreck(e) && !getUnitStats(e.type).canTow &&
          Math.max(Math.abs(sampleCellX(e.x, AI_W) - cx0),
                   Math.abs(worldToCellFloor(e.y) - cy0)) <= ESCORT_CELLS);
        if (!guarded) {
          commands.push({
            type: CMD_MOVE_ORDER, operatorId, targetCellX: cx0, targetCellY: cy0,
          });
          continue;
        }
      }
      if (asset.state !== ASSET_IDLE) continue;
      let target = null;
      {
        const ownStd = stdOf(state, asset.team);
        const enemyStd = stdOf(state, asset.team === 0 ? 1 : 0);
        if (enemyStd && enemyStd.status === STD_CARRIED && enemyStd.carrierAssetId === asset.id) {
          // Escort yourself home — to your standard's plinth, or (heist:
          // the attacker HAS no standard) to your own base centre.
          const ownBase = state.bases.find((b) => b.team === asset.team);
          target = ownStd
            ? [ownStd.homeCellX, ownStd.homeCellY]
            : [baseCentreCol(ownBase), ownBase.y + ((ownBase.height / 2) | 0)];
        } else if (ownStd && ownStd.status === STD_DROPPED && operatorId === recovererFor[asset.team]) {
          target = [sampleCellX(ownStd.x, AI_W), worldToCellFloor(ownStd.y)];
        } else if (enemyStd && asset.id === raiderFor[asset.team] &&
                   (enemyStd.status === STD_AT_BASE || enemyStd.status === STD_DROPPED)) {
          // Item 11 (ruled: BOTH triggers): the raid launches only as a
          // group attack (>=2 combat escorts alongside) OR through a
          // sneak window (thin defenses near the route). Otherwise the
          // carrier stays with the pack (falls through to patrol).
          if (raidWindowOpen(state, asset, visibleByTeam[asset.team])) {
            const sxr = sampleCellX(enemyStd.x, AI_W);
            const syr = worldToCellFloor(enemyStd.y);
            // HEIST HOLD-SHORT (prompt 141, the party law's core idea
            // for a 60hp hull): escorts lead the assault; the carrier
            // holds 8 cells short of a vault with >=2 live guards and
            // dives only once the escorts have thinned them. The hold
            // cell shifts toward OUR base (geometry-derived sign, so
            // it commutes with the mirror).
            let guards = 0;
            if (state.mission?.kind === MISSION_HEIST &&
                asset.team === state.mission.attacker) {
              for (const e of state.assets) {
                if (e.team !== asset.team && e.team !== -1 && !isWreck(e) &&
                    e.operatorId !== -1 &&
                    Math.max(Math.abs(sampleCellX(e.x, AI_W) - sxr),
                             Math.abs(worldToCellFloor(e.y) - syr)) <= 6) guards++;
              }
            }
            if (guards >= 2) {
              const ownBase = state.bases.find((b) => b.team === asset.team);
              const dir = baseCentreCol(ownBase) < sxr ? -1 : 1;
              target = [sxr + dir * 8, syr];
            } else {
              target = [sxr, syr];
            }
          }
        }
      }
      // Q72: the siege battery rides to its firing stand and stays —
      // the stand sits 9 cells from the vault toward OUR base
      // (geometry-derived sign, mirror-safe); inside 2 cells of it the
      // tube holds and the fire doctrine does the shelling.
      if (!target && siegeOps.has(operatorId) && state.mission?.kind === MISSION_HEIST) {
        const dStd = stdOf(state, asset.team === 0 ? 1 : 0);
        if (dStd) {
          const sxs = sampleCellX(dStd.x, AI_W);
          const sys = worldToCellFloor(dStd.y);
          const ownBase = state.bases.find((b) => b.team === asset.team);
          const dir = baseCentreCol(ownBase) < sxs ? -1 : 1;
          const standX = sxs + dir * 9;
          const d = Math.max(Math.abs(cellX0 - standX), Math.abs(cellY0 - sys));
          if (d > 2) target = [standX, sys];
        }
      }
      // Item 11: designated escorts converge on the carrier, then ride
      // along; inside 3 cells they hold formation (idle near the carrier
      // is exactly what opens the group-attack window).
      // THE ESCORT WALL (prompt 141): holding formation next to a
      // MOVING carrier parks bodies in its path — body collision
      // refuses entry and the raid entombs itself (a heist trace froze
      // 28 cells from the vault for 1,500 ticks, boxed by its own
      // guard). A moving leader's escorts share its DESTINATION and
      // keep rolling; only an idle leader is worth orbiting.
      if (!target && escortFor.has(operatorId)) {
        const c = state.assets[escortFor.get(operatorId)];
        if (c && !isWreck(c)) {
          const ecx = sampleCellX(c.x, AI_W);
          const ecy = worldToCellFloor(c.y);
          const d = Math.max(Math.abs(cellX0 - ecx), Math.abs(cellY0 - ecy));
          if (d > 3) {
            target = [ecx, ecy];
          } else if (state.mission?.kind === MISSION_HEIST &&
                     asset.team === state.mission.attacker) {
            // Prompt 141: heist escorts LEAD — once assembled on the
            // carrier they push the VAULT itself (clear the guards so
            // the hold-short carrier can dive); with the Asset aboard
            // our raider they screen the getaway instead.
            const dStd = stdOf(state, asset.team === 0 ? 1 : 0);
            if (dStd && (dStd.status === STD_AT_BASE || dStd.status === STD_DROPPED)) {
              target = [sampleCellX(dStd.x, AI_W), worldToCellFloor(dStd.y)];
            } else if (c.state === ASSET_MOVING) {
              target = [sampleCellX(c.targetX, AI_W), worldToCellFloor(c.targetY)];
            }
          } else if (c.state === ASSET_MOVING) {
            target = [sampleCellX(c.targetX, AI_W), worldToCellFloor(c.targetY)];
          }
        }
      }
      // 13B resupply runner (prompt 31): a truck with cargo tops up the
      // thirstiest nearby teammate — adjacent: transfer; else: drive to
      // them. Tubes first (artillery/mortar burn ammo fastest).
      // The CONVOY truck has one job: no resupply runs, no tow errands
      // — the mission clock does not wait for logistics side-quests.
      const isConvoyTruck = state.mission?.convoyId === asset.id;
      if (stats.canTow && !isConvoyTruck && (asset.cargoFuel > 0 || asset.cargoAmmo > 0)) {
        let needy = null;
        let bestScore = 0;
        for (const a of state.assets) {
          if (a.team !== asset.team || a.id === asset.id || isWreck(a)) continue;
          const wantAmmo = 12 - a.ammo;
          const wantFuel = Math.max(0, 2400 - a.fuel);
          if (a.ammo > 6 && a.fuel > 1200) continue; // not needy
          const dist = Math.max(Math.abs(sampleCellX(a.x, AI_W) - cellX0),
                                Math.abs(worldToCellFloor(a.y) - cellY0));
          if (dist > RESCUE_SEEK_CELLS) continue;
          const tube = getUnitStats(a.type).indirect ? 2 : 1;
          const score = tube * (wantAmmo * 200 + Math.floor(wantFuel / 12)) - dist;
          if (score > bestScore) { bestScore = score; needy = a; }
        }
        if (needy) {
          const dist = Math.max(Math.abs(sampleCellX(needy.x, AI_W) - cellX0),
                                Math.abs(worldToCellFloor(needy.y) - cellY0));
          if (dist <= 1) {
            commands.push({ type: CMD_TRANSFER_CARGO, operatorId, targetAssetId: needy.id });
            continue;
          }
          if (!target) target = [sampleCellX(needy.x, AI_W), worldToCellFloor(needy.y)];
        }
      }

      // 11F repair errands (Q9): a truck carrying materiel heads for a
      // damaged own/neutral site nearby; adjacency auto-repairs it.
      if (!target && stats.canTow && asset.materiel === 1) {
        let hurt = null;
        let bestDist = Infinity;
        for (const site of state.sites) {
          if ((site.hp ?? 1) > 0) continue;
          if (site.owner === (asset.team === 0 ? 1 : 0)) continue;
          const d = Math.max(Math.abs(site.cellX - cellX0), Math.abs(site.cellY - cellY0));
          if (d < bestDist) { bestDist = d; hurt = site; }
        }
        if (hurt && bestDist > 1 && bestDist <= RESCUE_SEEK_CELLS) {
          target = [hurt.cellX, hurt.cellY + 1]; // park beside, not on it
        }
        // 13E-2 REBUILD: a dropped span is a repair errand too. Either
        // team may rebuild any bridge (prompt-70), so the only question
        // is distance - and standing beside it does the work.
        if (!target) {
          let span = null;
          let spanDist = Infinity;
          for (const b of state.bridges ?? []) {
            if (bridgeIntact(b)) continue;
            const geom = bridgeSpans(state.mapProfile)[b.id];
            if (!geom) continue;
            const bx = (geom.cols[0] + geom.cols[1]) >> 1;
            const by = (geom.rows[0] + geom.rows[1]) >> 1;
            const d = Math.max(Math.abs(bx - cellX0), Math.abs(by - cellY0));
            if (d < spanDist) { spanDist = d; span = { geom, bx, by }; }
          }
          if (span && spanDist <= RESCUE_SEEK_CELLS &&
              !adjacentToBridge(state.mapProfile, 0, cellX0, cellY0)) {
            // Park just outside the span's edge ON THE APPROACH SIDE
            // (the old western-edge constant claimed "side-neutral" —
            // rung 4's other face: a fixed west is a chirality). Ties
            // at the span's own column break by the axis-side law.
            const west = cellX0 !== span.bx
              ? cellX0 < span.bx
              : 2 * cellX0 < AI_W - 1;
            target = west
              ? [span.geom.cols[0] - 1, span.by]
              : [span.geom.cols[1] + 1, span.by];
          }
        }
        // FIELD REPAIR (ruled 2026-07-30): patch a badly mauled teammate.
        // Ranked LAST of the materiel errands on purpose — infrastructure
        // is worth 8 Recognition and a patch 4, so a damaged relay or a
        // dropped span still outranks a hurt hull, exactly as the mission
        // card ordering tells human players.
        //
        // Only targets a hull BELOW half (the cap means anything above it
        // cannot be helped), and drives BESIDE it: adjacency does the work,
        // so parking on top would just body-block a wounded friendly.
        if (!target) {
          let patient = null;
          let patientDist = Infinity;
          for (const other of state.assets) {
            if (other.id === asset.id || other.team !== asset.team) continue;
            if (isWreck(other) || other.operatorId === -1) continue;
            if (other.hp * 2 >= getUnitStats(other.type).hp) continue;
            const d = Math.max(
              Math.abs(sampleCellX(other.x, AI_W) - cellX0),
              Math.abs(worldToCellFloor(other.y) - cellY0)
            );
            // Ties by asset id keep the choice deterministic; distance is
            // mirror-invariant so this does not introduce a chirality.
            if (d < patientDist || (d === patientDist && patient && other.id < patient.id)) {
              patientDist = d;
              patient = other;
            }
          }
          if (patient && patientDist > 1 && patientDist <= RESCUE_SEEK_CELLS) {
            // Park on the APPROACH side (rung 4 of the residue ladder:
            // the old hardcoded +1 always parked EAST — mirror of
            // park-east is park-west, so this one constant broke
            // equivariance for every repair errand). Same-column ties
            // break by the axis-side law.
            const px = sampleCellX(patient.x, AI_W);
            const side = px === cellX0
              ? (2 * cellX0 < AI_W - 1 ? -1 : 1)
              : (cellX0 < px ? -1 : 1);
            target = [px + side, worldToCellFloor(patient.y)];
          }
        }
      }

      // 11E full AI rescue play (Q5). Trucks: hook the nearest claimable
      // wreck, haul it home (the repair bay takes it from there). Carriers:
      // ferry aboard passengers home; otherwise fetch a walking downed
      // teammate nearby — unless this carrier is the team's raider on duty.
      // CONVOY mission targets — the gate IS the driver's job and the
      // ping IS the hunter's job; both outrank tow/ferry errands.
      if (!target && state.mission?.kind === MISSION_CONVOY &&
          state.mission.convoyId === asset.id) {
        // Same DASH as the pre-gate law: a parked truck a dozen cells
        // out relaunches escorts-or-none — the terminal stall was the
        // IDLE truck waiting here for escorts the wall-fight kept
        // eating.
        const dash = Math.max(Math.abs(cellX0 - state.mission.gateCellX),
                              Math.abs(cellY0 - state.mission.gateCellY)) <= 12;
        const guarded = dash || state.assets.some((e) =>
          e.team === asset.team && e.id !== asset.id && e.operatorId !== -1 &&
          !isWreck(e) && !getUnitStats(e.type).canTow &&
          Math.max(Math.abs(sampleCellX(e.x, AI_W) - cellX0),
                   Math.abs(worldToCellFloor(e.y) - cellY0)) <= ESCORT_CELLS);
        if (guarded) {
          target = [state.mission.gateCellX, state.mission.gateCellY];
        } else {
          continue; // parked, waiting for the escorts to close up
        }
      }
      // Alarm response beats relay errands: the compound holds seats.
      if (!target && prisonDefenderFor.get(asset.team) === operatorId) {
        const own = (state.prisons ?? []).find((p) => p.team === asset.team);
        if (own) {
          const d = Math.max(Math.abs(cellX0 - own.cellX), Math.abs(cellY0 - own.cellY));
          if (d > 2) target = [own.cellX, own.cellY];
        }
      }
      if (!target && interceptorOps.has(operatorId) && this.convoyIntel) {
        const d = Math.max(Math.abs(cellX0 - this.convoyIntel[0]),
                           Math.abs(cellY0 - this.convoyIntel[1]));
        if (d > 2) target = this.convoyIntel;
      }
      // (Wrecker movement lives in the pre-gate block above — a hard
      // designation, so resupply side-quests can never preempt it.)
      // MODE WAR POSTURE: relays cannot win a convoy war, so the rest
      // of both lines fights where the mission is. Free attacker
      // combat hulls mass on the convoy (the rolling front); free
      // defender combat hulls hold their gate (the fortress). Escorts,
      // interceptors and the wrecker keep their special laws above.
      if (!target && state.mission?.kind === MISSION_CONVOY &&
          !stats.canTow && !stats.canCarryStandard && !stats.indirect) {
        const m2 = state.mission;
        if (asset.team === m2.attacker) {
          const cv = state.assets[m2.convoyId];
          if (cv) {
            const wx = sampleCellX(cv.x, AI_W);
            const wy = worldToCellFloor(cv.y);
            if (Math.max(Math.abs(cellX0 - wx), Math.abs(cellY0 - wy)) > 4) {
              target = [wx, wy];
            }
          }
        } else {
          const d = Math.max(Math.abs(cellX0 - m2.gateCellX),
                             Math.abs(cellY0 - m2.gateCellY));
          if (d > 8) target = [m2.gateCellX, m2.gateCellY];
        }
      }
      // Q52 HEIST posture: relays cannot win this war either. Free
      // attacker combat hulls mass on the RAID CARRIER (the escort
      // census is what opens the group-attack window); free defenders
      // hold near the Asset — at home, or wherever the thief drags it.
      if (!target && state.mission?.kind === MISSION_HEIST &&
          !stats.canTow && !stats.canCarryStandard && !stats.indirect) {
        const m2 = state.mission;
        if (asset.team === m2.attacker) {
          const cv = state.assets[raiderFor[asset.team] ?? -1];
          if (cv && !isWreck(cv)) {
            const wx = sampleCellX(cv.x, AI_W);
            const wy = worldToCellFloor(cv.y);
            if (Math.max(Math.abs(cellX0 - wx), Math.abs(cellY0 - wy)) > 3) {
              target = [wx, wy];
            }
          }
        } else if (vaultGuardOps.has(operatorId)) {
          const std = stdOf(state, asset.team);
          if (std) {
            const sx = sampleCellX(std.x, AI_W);
            const sy = worldToCellFloor(std.y);
            const d = Math.max(Math.abs(cellX0 - sx), Math.abs(cellY0 - sy));
            if (d > 5) target = [sx, sy];
          }
        }
      }
      if (!target && stats.canTow) {
        const inTow = towedWreck(state, asset.id);
        if (inTow) {
          target = homeCellFor(state, asset.team);
        } else {
          let wreck = null;
          let bestDist = Infinity;
          for (const w of state.assets) {
            if (w.team !== asset.team || !isWreck(w)) continue;
            if (w.towedBy !== -1 || w.recoverTimer > 0) continue;
            // The convoy wreck is NEVER towed home — the restart law
            // owns it (a tow would drag the mission backward).
            if (state.mission?.convoyId === w.id) continue;
            const d = Math.max(Math.abs(sampleCellX(w.x, AI_W) - cellX0),
                               Math.abs(worldToCellFloor(w.y) - cellY0));
            if (d < bestDist) { bestDist = d; wreck = w; }
          }
          if (wreck && bestDist <= RESCUE_SEEK_CELLS) {
            if (towRejection(state, asset, wreck) === null) {
              commands.push({ type: CMD_TOW_ORDER, operatorId, wreckAssetId: wreck.id });
              continue;
            }
            target = [sampleCellX(wreck.x, AI_W), worldToCellFloor(wreck.y)];
          }
        }
      }
      if (!target && stats.capacity > 0) {
        if (asset.aboard1 !== -1 || asset.aboard2 !== -1) {
          target = homeCellFor(state, asset.team); // deliver at base idle
        } else if (asset.id !== raiderFor[asset.team]) {
          let body = null;
          let bestDist = Infinity;
          for (const d of state.downed) {
            if (d.team !== asset.team) continue;
            const dist = Math.max(Math.abs(sampleCellX(d.x, AI_W) - cellX0),
                                  Math.abs(worldToCellFloor(d.y) - cellY0));
            if (dist < bestDist) { bestDist = dist; body = d; }
          }
          if (body && bestDist <= RESCUE_SEEK_CELLS) {
            target = [sampleCellX(body.x, AI_W), worldToCellFloor(body.y)];
          }
        }
      }

      // LAST CONVOY: a convoy member's one job is getting home. Beats
      // every other errand — the quota is the team's remaining story.
      if (!target) {
        const cv = state.convoy?.[asset.team];
        if (cv?.active && cv.done < cv.need && cv.ids.includes(asset.id)) {
          const home = state.bases.find((b) => b.team === asset.team);
          if (home) {
            const hx = baseCentreCol(home);
            const hy = home.y + ((home.height / 2) | 0);
            if (sampleCellX(asset.x, AI_W) !== hx || worldToCellFloor(asset.y) !== hy) {
              target = [hx, hy];
            }
          }
        }
      }
      // POW slice 2: a scout IN CUSTODY heads straight home — the
      // capture pays at the prison gate, nowhere else.
      if (!target && asset.type === 1 && (asset.prisoner ?? -1) !== -1) {
        const home = (state.prisons ?? []).find((p) => p.team === asset.team);
        if (home) target = [home.cellX, home.cellY];
      }
      // (POW raid movement lives in the FORMATION block above — the
      // party pre-gate law owns raider and escorts alike.)
      // B6: the designated drop-securer rides for the crate before any
      // relay errand — the packet is one-shot and the window is shared.
      if (!target && securerFor.get(asset.team) === operatorId) {
        const liveDrop = (state.drops ?? []).find(
          (d) => d.securedBy === -1 && state.tick >= d.activateTick);
        if (liveDrop) target = [state.map.width >> 1, liveDrop.cellY];
      }
      // 11C capture-seek (11B consequence): the countdown killed drive-by
      // captures. The designated capturer diverts to its relay and stands
      // on it (standing on the target cell issues no move — the dwell IS
      // the capture). It won't stare down an enemy-held flag it cannot
      // shoot at (out of supply): that froze whole wars at 0-0.
      if (!target) {
        // MODE WARS (Q62): attacker flag errands are CORRIDOR-ONLY —
        // the movement gate mirrors the designation gate above.
        const missionAttacker = state.mission &&
          asset.team === state.mission.attacker;
        let relay = nearestUnownedRelay(state, asset);
        if (missionAttacker && relay && !corridorRelay(state, asset.team, relay)) relay = null;
        if (relay && capturerFor.get(`${asset.team}:${relay.id}`) === operatorId) {
          const enemyOnFlag = state.assets.some((e) =>
            e.team !== asset.team && !isWreck(e) &&
            sampleCellX(e.x, AI_W) === relay.cellX && worldToCellFloor(e.y) === relay.cellY);
          if (!enemyOnFlag || inSupply(state, asset)) {
            target = [relay.cellX, relay.cellY];
          }
        }
      }
      // 11V: fast, path-loving chassis take the trail routes.
      const lightRunner = !stats.heavy && stats.speed >= 56;
      if (!target && agent && this.difficulty !== AI_HARD) {
        target = patrolTarget(agent, state.tick, state.mapProfile, this.mirrored, lightRunner);
      } else if (!target) {
        const relay = nearestUnownedRelay(state, asset);
        if (relay) target = [relay.cellX, relay.cellY];
        else if (agent) target = patrolTarget(agent, state.tick, state.mapProfile, this.mirrored, lightRunner);
      }
      if (!target) continue;
      const currentCellX = sampleCellX(asset.x, AI_W);
      const currentCellY = worldToCellFloor(asset.y);
      if (currentCellX !== target[0] || currentCellY !== target[1]) {
        // 13C: long hauls ride the route graph — waypoint chains along
        // roads, trails (light hulls), and bridges replace the straight
        // line that forded rivers and crawled cross-country. Stateless:
        // the route is recomputed from the CURRENT cell each cycle and
        // nextWaypoint picks the leg; arriving idle triggers the next.
        let step = target;
        // 13D: route around what the team KNOWS — marked enemy mines
        // re-cost the graph (area denial becomes real).
        const hazards = [];
        for (const m of state.mines) {
          if (m.team !== asset.team && m.marked === 1) hazards.push([m.cellX, m.cellY]);
        }
        const route = routeWaypoints(
          state.mapProfile, currentCellX, currentCellY, target[0], target[1], stats, hazards);
        if (route.length) {
          const wp = nextWaypoint(route, currentCellX, currentCellY);
          if (wp && (wp[0] !== currentCellX || wp[1] !== currentCellY)) step = wp;
        }
        commands.push({
          type: CMD_MOVE_ORDER, operatorId,
          targetCellX: step[0], targetCellY: step[1],
        });
      }
    }
    if (this.orderParity && (state.tick & 1) === 1) {
      // Stable partition: B-issued commands first on odd ticks. The
      // sort key is the ISSUING team only — within a team the original
      // order (and thus every per-operator sequence) is preserved.
      const teamOf = (c) => state.operators[c.operatorId]?.team ?? -1;
      const b = commands.filter((c) => teamOf(c) === 1);
      const rest = commands.filter((c) => teamOf(c) !== 1);
      return b.concat(rest);
    }
    return commands;
  }
}
