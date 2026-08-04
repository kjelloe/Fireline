// engine/view.js — fog-filtered per-team view builder (1E contract, 1F mapCells,
// 1H LOS). Views are the only state representation that may cross the network.
// Enemy visibility is decided by engine/los.js; enemy records leak no
// hp/target/operator information.

export { FOG_RADIUS_CELLS } from "./los.js";
import { computeVisible } from "./los.js";
import { dropActive } from "./drops.js";

// LAST CONVOY: a public emergency — the hunted and the hunters both
// need the count. Membership ids stay engine-side; the client only
// needs the scoreboard shape.
function projectConvoy(state) {
  return (state.convoy ?? []).map((c) => ({
    active: c.active, need: c.need, done: c.done,
  }));
}

// POW arc: prisons are public landmarks — position and HEADCOUNT are
// visible to both teams (the day-one objective must be findable);
// prisoner identities ride too (they are your teammates).
function projectPrisons(state) {
  return (state.prisons ?? []).map((p) => ({
    team: p.team, cellX: p.cellX, cellY: p.cellY,
    pows: p.pows.map((pw) => ({ ...pw })), raidTicks: p.raidTicks,
  }));
}

// B6: the supply drop is ANNOUNCED — both teams see it the moment it
// activates, fog or not (an unannounced windfall is just luck).
function projectDrops(state) {
  return (state.drops ?? [])
    .filter((d) => dropActive(d, state.tick))
    .map((d) => ({
      id: d.id, cellX: state.map.width >> 1, cellY: d.cellY,
      holdTicks: d.holdTicks, heldBy: d.heldBy,
    }));
}

// 10A: spectators see the whole war — every asset with full telemetry,
// both teams' downed operators, every mine, all events (pings included).
// Shaped like a player view (assets ride in friendlyAssets) so the client
// renders it without a special path. Read-only by transport contract.
export function buildSpectatorView(state) {
  const friendlyAssets = state.assets.map((a) => ({
    id: a.id, type: a.type, team: a.team, state: a.state,
    x: a.x, y: a.y, targetX: a.targetX, targetY: a.targetY,
    hp: a.hp, operatorId: a.operatorId,
    ammo: a.ammo, fuel: a.fuel,
    towedBy: a.towedBy, recoverTimer: a.recoverTimer,
    reloadTimer: a.reloadTimer,
    heading: a.heading, minesLeft: a.minesLeft, caltropsLeft: a.caltropsLeft ?? 0,
      sandbagsLeft: a.sandbagsLeft ?? 0, // W4-4: your own rack (the ghost + the HUD need it)
    aboard1: a.aboard1, aboard2: a.aboard2,
  }));
  return {
    tick: state.tick,
    mapProfile: state.mapProfile, // premium disclosure + map-aware UI
    team: -1,
    spectator: true,
    phase: state.phase,
    winner: state.winner,
    teamScores: [...state.teamScores],
    tickets: state.tickets ? [...state.tickets] : [0, 0], // 13H: public pacing info
    salvage: state.salvage ? [...state.salvage] : [0, 0], // public, like tickets
    convoy: projectConvoy(state), // Last Convoy: a public emergency
    // Mode framework: the mission brief is public (what, who, where,
    // how long). The convoy's LIVE position stays fog + radio pings.
    mission: state.mission ? { ...state.mission } : null,
    drops: projectDrops(state), // B6: announced to everyone, no fog
    prisons: projectPrisons(state), // POW arc: compounds are public knowledge
    events: state.events,
    mapCells: state.map.cells,
    friendlyAssets,
    visibleEnemies: [],
    sites: state.sites.map((s) => ({
      id: s.id, type: s.type, kind: s.kind ?? 0, owner: s.owner, cellX: s.cellX, cellY: s.cellY,
    })),
    bases: state.bases.map((b) => ({ ...b })),
    standards: state.standards.map((st) => ({ ...st })),
    downedOperators: state.downed.map((d) => ({ ...d })),
    mines: state.mines.map((m) => ({
      id: m.id, team: m.team, cellX: m.cellX, cellY: m.cellY,
      armed: m.armTimer === 0, marked: m.marked === 1,
    })),
    caltrops: (state.caltrops ?? []).map((c) => ({ ...c })), // Q45
    sandbags: (state.sandbags ?? []).map((s) => ({ ...s })), // Q45/Q50: structures are public
    drones: state.drones.map((d) => ({
      id: d.id, team: d.team, x: d.x, y: d.y, targetAssetId: d.targetAssetId,
    })),
  };
}

export function buildView(state, team) {
  const friendlyAssets = state.assets
    .filter((a) => a.team === team)
    .map((a) => ({
      id: a.id, type: a.type, team: a.team, state: a.state,
      x: a.x, y: a.y, targetX: a.targetX, targetY: a.targetY,
      hp: a.hp, operatorId: a.operatorId,
      ammo: a.ammo, fuel: a.fuel,
      towedBy: a.towedBy, recoverTimer: a.recoverTimer,
      reloadTimer: a.reloadTimer,
      heading: a.heading, minesLeft: a.minesLeft, caltropsLeft: a.caltropsLeft ?? 0,
      sandbagsLeft: a.sandbagsLeft ?? 0, // W4-4: your own rack (the ghost + the HUD need it)
      aboard1: a.aboard1, aboard2: a.aboard2, // 10B: takeover context
      materiel: a.materiel, // 11F
      driveThrottle: a.driveThrottle, driveTurn: a.driveTurn, // 11L
      deployed: a.deployed, deployTimer: a.deployTimer, // 12B
      cargoFuel: a.cargoFuel, cargoAmmo: a.cargoAmmo, // 13A
      stationOp: a.stationOp ?? -1, stationAmmo: a.stationAmmo ?? 0, // prompt-100
      stationReload: a.stationReload ?? 0,
      campTicks: a.campTicks ?? 0, // W4-2: the client warns before the drone
    }));

  const visible = computeVisible(state, team);
  const visibleEnemies = state.assets
    .filter((a) => visible.has(a.id))
    .map((a) => ({
      id: a.id, type: a.type, team: a.team, state: a.state,
      x: a.x, y: a.y, heading: a.heading,
      deployed: a.deployed, // 12B: a raised hardpoint is externally obvious
    }));

  // Relay infrastructure and base zones are public knowledge.
  const sites = state.sites.map((s) => ({
    id: s.id, type: s.type, kind: s.kind ?? 0, owner: s.owner, cellX: s.cellX, cellY: s.cellY,
    captureProgress: s.captureProgress, capturingTeam: s.capturingTeam, // 11B
    hp: s.hp, // 11F: infrastructure state is public, like ownership
  }));
  const bases = state.bases.map((b) => ({ ...b }));
  // 9B: downed operators are visible to their OWN team only (enemies cannot
  // see or target them — follow-up ruling 1).
  const downedOperators = state.downed
    .filter((d) => d.team === team)
    .map((d) => ({ ...d }));
  // 9E: a team sees its own mines always, enemy mines only once marked.
  const mines = state.mines
    .filter((m) => m.team === team || m.marked === 1)
    .map((m) => ({
      id: m.id, team: m.team, cellX: m.cellX, cellY: m.cellY,
      armed: m.armTimer === 0, marked: m.marked === 1,
    }));
  // Q45: own caltrops always; enemy patches are SURFACE litter — seen
  // when any friendly stands within 4 cells (the ruled
  // "close-or-scouted", without a new marking mechanic).
  const caltrops = (state.caltrops ?? [])
    .filter((c) => c.team === team || state.assets.some((a) =>
      a.team === team && a.operatorId !== -1 &&
      a.state !== 2 && a.state !== 3 &&
      Math.max(Math.abs(((a.x / 256) | 0) - c.cellX),
               Math.abs(((a.y / 256) | 0) - c.cellY)) <= 4))
    .map((c) => ({ ...c }));
  // 9G: drones are loud, low, and public — both teams always see them.
  const drones = state.drones.map((d) => ({
    id: d.id, team: d.team, x: d.x, y: d.y, targetAssetId: d.targetAssetId,
  }));
  // 8A: Command Standards are a deliberate fog exception — both teams always
  // know both standards' position and status. The stolen flag IS the drama.
  const standards = state.standards.map((st) => ({ ...st }));

  // 11K: the public scoreboard — recognition is meant to be SEEN.
  const operators = state.operators
    .filter((o) => o.state !== 0)
    .map((o) => ({ id: o.id, team: o.team, score: o.score, respawnTicks: o.respawnTicks ?? 0, deeds: [...(o.deeds ?? [])] })); // 15; deeds B4

  return {
    tick: state.tick,
    mapProfile: state.mapProfile, // premium disclosure + map-aware UI
    team,
    operators,
    phase: state.phase,
    winner: state.winner,
    teamScores: [...state.teamScores],
    tickets: state.tickets ? [...state.tickets] : [0, 0], // 13H
    salvage: state.salvage ? [...state.salvage] : [0, 0], // public, like tickets
    convoy: projectConvoy(state), // Last Convoy: a public emergency
    // Mode framework: the mission brief is public (what, who, where,
    // how long). The convoy's LIVE position stays fog + radio pings.
    mission: state.mission ? { ...state.mission } : null,
    drops: projectDrops(state), // B6: announced to everyone, no fog
    prisons: projectPrisons(state), // POW arc: compounds are public knowledge
    // 10C: events carrying toTeam are that team's business only (pings).
    events: state.events.filter((e) => e.toTeam === undefined || e.toTeam === team),
    mapCells: state.map.cells,
    friendlyAssets,
    visibleEnemies,
    sites,
    bases,
    standards,
    downedOperators,
    mines,
    caltrops,
    sandbags: (state.sandbags ?? []).map((s) => ({ ...s })), // Q45/Q50: structures are public
    drones,
  };
}
