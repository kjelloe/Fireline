# Plan: from v0.9.0 to a fully playable Version 1

> **STATUS UPDATE (2026-07-26): P0 AND P1 ARE IMPLEMENTED** (v0.10.0,
> 247/247 tests) as Phase 8 slices 8A-8I per the designer-approved plan in
> `specs/phase8_core_fantasy_retrofit.md` — Command Standards, war lifecycle,
> tow-back recovery, fire cooldowns, minimap, free camera, click-select,
> order feedback, end-of-war screen, heartbeats, and balance metrics
> (`/metrics`). What remains before calling v1 done: the human acceptance
> passes (browser + 2-human LAN) and the P1-G balance pass they feed.
> Original analysis kept below for the record.

What exists today (v0.9.0, 199/199 tests): a deterministic 32-participant war
over relay supply lines — combat, fog, supply, capture, victory, AI regency,
reconnect, replays, a browser client — verified headlessly end-to-end.
What follows is what still separates "all tests green" from "a game people
sit down and enjoy," ordered by how hard each item blocks that goal.

Estimated total: ~6-9 focused slices to P0/P1 completion, art track separate.

---

## P0 — blockers: without these it isn't a full game

### 1. The Command Standard (the flag) — the missing core fantasy
The specs' marquee objective — capture the enemy's Command Standard and carry
it home while yours stays safe (the 1987 flag-capture DNA) — is **not
implemented**. Current victory (elimination / relay domination / points) is
scaffolding around the real thing.
- Engine: standard entity per team (in base), pickup on drive-over, carried
  state (drops on disablement), return-to-own-base scoring/win, hashed.
- Client: carried-standard indicator, "standard taken!" alerts.
- This is the single highest-value missing mechanic. *(engine + client, 1 slice)*

### 2. War lifecycle — the server is one-shot
After `game_over` the world freezes forever; a fresh war needs a process
restart. Drop-in philosophy demands a continuous front.
- Post-war intermission (scoreboard for ~30s), then auto-start a new war with
  a deterministic next seed; reset transport reservations/regency; archive
  handled (done). Slim version of 5C rotation, no map voting needed.
  *(server, 1 slice)*

### 3. Attrition dead-end — disablement is forever
With no recovery, long wars decay into wreck fields (the 4000-tick soak ends
with most assets dead). The specs' identity is "disable, recover, repair,
rescue" over deletion. Minimum viable loop:
- `call_medic`/`respawn` are validated no-ops today — implement ONE of:
  (a) wreck recovery: a friendly asset adjacent to a wreck for N ticks tows it
  back to operable at low hp (rescue gameplay, very Firepower), or
  (b) timed base respawn of destroyed chassis (simpler, less flavorful).
  Recommendation: (a) — it creates missions, not menus. *(engine, 1 slice)*

### 4. Fire cadence — combat is a click race
No cooldown: whoever spams fire_order fastest wins; AI fires every tick.
- Per-chassis `reloadTicks` (tank ~15, scout ~8, artillery ~40) enforced in
  the reducer (`reloadTimer` hashed per asset), rejection "reloading".
- Client: reload indicator on the HUD. *(engine + client, small slice)*

## P1 — required for the game to be legible and fair

### 5. Player legibility kit (client only)
- Minimap (mapCells + sites + own assets + spotted enemies) with click-to-pan.
- Free camera pan/zoom (drag/wheel/pinch) — follow mode is the only view now.
- Click your own unit to select it (only HUD "Next asset" cycling today).
- Objective/status strip: relay ownership pips, both team scores, war clock.
- End-of-war screen (winner, reason, scores, per-player stats) instead of a
  feed line. *(client, 1-2 slices)*

### 6. Order feedback
Rejections surface as raw feed text ("rejected: out of supply"). Convert to
readable, positioned feedback (flash the supply ring when out of supply, red
target ring when out of range, etc). Move-order destination markers.
*(client, small slice)*

### 7. Balance pass (numbers, not systems)
Playtest-driven tuning of: BASE movement pace (16/256 cell/tick is slow —
consider global ×1.5-2 with re-pinning), supply radii, suppression effect,
artillery damage vs reload, scout vision advantage (currently all chassis see
12 cells — scouts should see farther to earn their spotter role), relay
domination hold time. Needs the LAN sessions to inform it. *(engine consts)*

### 8. Session robustness
- WS heartbeat/timeout (a hung socket currently holds its operator slot until
  TCP notices; regency should assume after ~5s of silence).
- `s_rejected` for malformed gameplay payloads (silent drop today).
- Optional: spectate-while-dead instead of a frozen view. *(server, small)*

## P2 — strongly desirable, not blocking

- **Replay viewer**: replays are stored and byte-exact but nothing plays them
  back visually. A client mode that feeds an archived log through the reducer
  locally would showcase the engine's best property. *(client)*
- **Second map profile** to prove the profile system (mapgen exists; only
  frontier_corridor is registered).
- **Persistent player profiles/leaderboard** (full 5B/7C) once wars rotate.
- **Mobile controls** (6C) — the client is touch-hostile today.
- **Onboarding hints** (slim 7D): first-join tooltip sequence.
- **Larger AI ambition**: regents don't defend owned relays or coordinate;
  fine post-v1.

## Acceptance definition for "fully playable v1"

1. Two humans on LAN + AI regents can play a complete war: contest relays,
   steal a Command Standard, lose/rescue assets, and reach a game-over screen
   — then keep playing the next war without touching the server.
2. A newcomer can join mid-war and understand where they are, what they
   drive, and what to do inside 60 seconds without being told.
3. `npm test` green throughout; every new mechanic hashed, replayable, and
   fixture-pinned.

## Explicitly out of v1 (unchanged from earlier decision)
Lobbies/matchmaking, campaign, biome variety, telemetry, modding/map editor,
i18n, accessibility suite, achievements. See `dev-log.md` marker-0019.

---

## Next conversation: art asset track
The client is deliberately placeholder-shaped to receive an art direction:
meshes are boxes/cylinders keyed by chassis type, terrain is flat colored
tiles keyed by terrain id, audio is synth tones keyed by cue name — each a
single mapping table to swap. Candidate directions are listed in
`specs/02_detailed_systems_document.md` / `initial-prompt.md` §10 (toy
diorama, tin soldiers, low-poly tactical, board-game terrain...). Decision
needed before asset production: style, then a unit silhouette test in-engine,
then terrain/UI palette, then audio identity.
