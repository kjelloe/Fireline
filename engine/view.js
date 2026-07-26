// engine/view.js — fog-filtered per-team view builder (1E contract, 1F mapCells,
// 1H LOS). Views are the only state representation that may cross the network.
// Enemy visibility is decided by engine/los.js; enemy records leak no
// hp/target/operator information.

export { FOG_RADIUS_CELLS } from "./los.js";
import { computeVisible } from "./los.js";

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
    heading: a.heading, minesLeft: a.minesLeft,
    aboard1: a.aboard1, aboard2: a.aboard2,
  }));
  return {
    tick: state.tick,
    team: -1,
    spectator: true,
    phase: state.phase,
    winner: state.winner,
    teamScores: [...state.teamScores],
    events: state.events,
    mapCells: state.map.cells,
    friendlyAssets,
    visibleEnemies: [],
    sites: state.sites.map((s) => ({
      id: s.id, type: s.type, owner: s.owner, cellX: s.cellX, cellY: s.cellY,
    })),
    bases: state.bases.map((b) => ({ ...b })),
    standards: state.standards.map((st) => ({ ...st })),
    downedOperators: state.downed.map((d) => ({ ...d })),
    mines: state.mines.map((m) => ({
      id: m.id, team: m.team, cellX: m.cellX, cellY: m.cellY,
      armed: m.armTimer === 0, marked: m.marked === 1,
    })),
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
      heading: a.heading, minesLeft: a.minesLeft,
      aboard1: a.aboard1, aboard2: a.aboard2, // 10B: takeover context
      materiel: a.materiel, // 11F
    }));

  const visible = computeVisible(state, team);
  const visibleEnemies = state.assets
    .filter((a) => visible.has(a.id))
    .map((a) => ({ id: a.id, type: a.type, team: a.team, state: a.state, x: a.x, y: a.y, heading: a.heading }));

  // Relay infrastructure and base zones are public knowledge.
  const sites = state.sites.map((s) => ({
    id: s.id, type: s.type, owner: s.owner, cellX: s.cellX, cellY: s.cellY,
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
    .map((o) => ({ id: o.id, team: o.team, score: o.score }));

  return {
    tick: state.tick,
    team,
    operators,
    phase: state.phase,
    winner: state.winner,
    teamScores: [...state.teamScores],
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
    drones,
  };
}
