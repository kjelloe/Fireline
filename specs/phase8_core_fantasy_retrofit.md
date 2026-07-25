# Phase 8: Core Fantasy Retrofit — designer-approved plan (2026-07-25)

Source: designer ally response to `plan-version1.md` (relayed verbatim by the
project owner; condensed here — decisions binding).

## Vision correction

> More Firepower is a deterministic, server-authoritative, no-lobby tactical
> wargame where players drop into active miniature wars and fight over
> physical Command Standards. The battlefield persists through damage,
> wrecks, rescues, AI regency, and shifting momentum. The client presents a
> readable toy-war diorama, while the server owns every outcome.

The Command Standard is the core; site control, elimination and timeout stay
as secondary/fallback victory paths.

## P0 slices (game not "first playable" until all done)

### 8A — Command Standard state model (engine)
Physical per-team standard object in deterministic state:
`{standardId, teamId, x, y, carrierAssetId, homeX, homeY, status, recoverTick}`.
Statuses: AT_BASE, CARRIED, DROPPED, (RECOVERING), SCORED. Standards should be
coarse-grained visible enough to create drama (deliberate fog exception).

### 8B — Pick up / drop / return / score (engine)
- Pickup: eligible unit enters the standard's cell (drive-over).
- Carry: carrier marked, slowed, strategically hot.
- Drop: carrier disabled → standard drops in place.
- Return: friendly unit touching own dropped standard returns it.
- Score: enemy standard reaches friendly command zone **AND own standard is
  AT_BASE** ("we have theirs, they have ours" tension).
- v1 mode: **first successful capture wins the war** (sudden capture).

### 8C — Victory integration + war lifecycle (engine + server)
- `standard_captured` becomes the primary victory reason.
- Lifecycle: `active → game_over → postgame → resetting → active`;
  results shown for N ticks; map/seed rotates deterministically; connected
  players remain connected; server never needs a restart.

### 8D — Wreck tow-back recovery (engine)
Tow-back rescue, NOT menu respawn: wreck → friendly asset tows (speed
penalty) → repair at own base → after deterministic recovery ticks returns
to service. Knobs: tow speed penalty, recovery zone, repair duration.

### 8E — Fire cooldown (engine)
Reducer-enforced per-chassis cooldowns advanced by authoritative ticks;
client shows reload UI only; rejections give visible feedback. Tests: fire at
T ok, T+1 rejected, T+cooldown ok, deterministic.

## P1 slices

- **8F** Minimap + standard awareness (fog-aware, own units, visible enemies,
  standards, command zones, viewport).
- **8G** Free camera (pan/zoom/hotkeys) + click-select / right-click orders.
- **8H** Order feedback (accepted/rejected/completed with reasons) +
  end-of-war screen (winner, reason, stats, next-war countdown).
- **8I** WS heartbeats/timeouts + rejoin token + LAN balance instrumentation
  (war duration, capture attempts, recovery rate, rejection rates).

## Test contract
`test/milestone8a.test.js` … `test/milestone8i.test.js`; every slice lists
exports; no test imports unexported names. All architectural rules unchanged
(client never owns logic; no randomness/wall-clock/floats in authoritative
code).

## Strongest recommendations (binding)
1. Command Standard before any new content.
2. Tow-back rescue over menu respawn.
3. Cooldowns before balance testing.
4. Automatic war lifecycle.
5. P1 legibility is gameplay, not polish.
