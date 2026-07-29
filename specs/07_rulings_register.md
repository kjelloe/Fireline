# Fireline Command — Design Rulings Register

**Status:** Living document. Every gameplay-affecting design ruling made
during development, in one durable place. (The verbatim prompt log is a
local-only file by choice; this register records the *decisions*.
`dev-log.md` records how each landed.)

## The tenet every ruling is tested against (prompt 62)

> **"Can every type of player find something useful and fun to do
> within 60 seconds of spawning?"**

Elevated from the map-design checklist to the general law for ALL
design decisions — maps, chassis, missions, pacing rules. It catches
this game's characteristic failure modes earlier than any sweep does:
running-simulator travel, objectives nobody visits, support roles with
nothing to do, and mid-war slumps. To apply it, walk the roster (tank,
scout, truck, carrier, bike, mortar, artillery, faction unique, downed
operator on foot) and name each one's useful first-minute action; if an
answer is "travel toward the fight" or "wait", the design is not done.

The engine has a hard-edged version of the same law: an objective
outside `CAPTURE_SEEK_CELLS` of where units actually go is never used
at all (18C, below).

## Core fantasy & objective (prompts 16–19 era)

- **Rescue outranks kills** — Recognition scoring: tow 8, rescue 10,
  standard return 10, standard capture 25, relay 10, kill 5. Awards go
  to the operator at the verified reducer fact; automatic outcomes
  (mines, drones, auto-return) award nobody.
- **Command Standard** is the primary objective; only carriers take the
  enemy standard; scoring requires your own standard secure.
- **BF2-style relay capture**: neutralize ~3 s + capture ~3 s countdown,
  presence-based; bikes neither capture nor contest; only artillery
  breaches sites (siege flag).
- **Damaged sites**: relays/depots have hp; artillery shells them;
  trucks repair via materiel.
- **MPG (Minimum Playability Guarantee)**: below N operable, the base
  slow-manufactures rebuilds. Session-tunable (13F rules, hashed).
  RULED (BF2 study): rebuilds arrive as a FULL WAVE per cadence.
  Rebuild position is base-derived (mirror-honest), type/row pinned.
- **Difficulty presets** (13G): easy 8/600 · normal 6/900 (= default,
  identity-pinned) · hard 4/1500; server-only (`RULES=` env) for now.

## Roster & factions

- 9 chassis, explicit contract flags on every one: canTow,
  canCarryStandard, capacity, canMine, canClearMines, heavy, canCapture,
  siege, deployable (Sentinel), amphibious (Skimmer).
- Per team: 4 tank / 3 scout / 2 artillery / 3 logistics / 2 carrier /
  1 bike / 1 mortar (+ faction unique in garage slot idx 10).
- **Factions** (designer ruling, specs/faction-name-and-units.md): The
  Directorate (slate/police blue, grid shield, Sentinel / Deploy
  Hardpoint) vs The Outliers (terracotta/tan, offset arrow, Skimmer /
  Riverline Drive). Identity-only in 12A; uniques replace a garage
  slot; never a 17th asset. Asymmetry gated by the faction-swap sweep.
- **Unique AI crewing (16B): LIVE, default ON** (prompt-54): Riverline
  Drive gained TRAIL AFFINITY (T_PATH 384, amphibious only) and the
  swap gate closed at 54.5% Sentinel-side. Band-tightening (prompt-56)
  EXECUTED: trail affinity 416 + Sentinel hp 120 (fixture v40) —
  NORMAL-WORLD split 51.3% (the 52/48 target where players live); the
  swap metric saturates at 53.6 (stat levers exhausted; structural
  option filed: Skimmer capture-speed affinity — designer's call).

## Fairness (the non-negotiables)

- Mirror symmetry is a TESTED balance invariant: spawns, relays,
  patrols, route-graph tables all mirror-closed. See
  specs/08_fairness_and_symmetry.md for the doctrine.
- Tick-parity command order (16A) and parity march order (17) — no
  team owns the first move, in commands or in physics.
- Acceptance bands: aggregate win rate across mirror worlds ~50%;
  chassis pairs judged by the faction-swap transform.

## Movement & physics

- Integer fixed-point (256/cell); truncDiv stepping (mirror-symmetric);
  even-index heading-snap tie-break; per-chassis terrain speeds incl.
  T_PATH (heavy penalty) and T_WATER (amphibious highway).
- **Collision (17, playtest-7 ruling)**: HARD blocking vs enemies
  (block radius 192), SOFT half-speed compression through friends
  (radius 128); only CLOSING moves constrained — separating is always
  legal; wrecks and downed crews don't collide (v1). Body-blocking is
  an intended tactic.
- **Route graph (13C)**: AI drives waypoint chains on per-profile
  road/trail/bridge graphs; equivariant tie-breaks proven by
  enumeration; amphibious hulls skip the graph.
- **Impassable terrain is a WALL (18B)**: units refuse to enter a
  0-speed cell and stall at its face (speed samples the current cell,
  so entering would trap them forever). Drones fly over; downed crews
  walk terrain-free. Engine-wide, inert on maps without T_BLOCKING.
- **Objectives must sit in reach (18C)**: a relay further than
  `CAPTURE_SEEK_CELLS` (16, Manhattan) from anywhere units actually go
  is never captured by anyone — the AI designates capturers only from
  assets already inside that radius. Such a relay silently leaves the
  ticket math and can make the majority unreachable. Map-side rule (the
  radius is NOT tuned per map — that would reopen every map's balance).
- **Bridge demolition (13E, LANDED)**: riverline spans are damageable
  ({id,hp}, hashed). ONLY artillery breaches them; a breached span turns
  to WATER (so the amphibious Skimmer is the standing answer to a
  demolition); EITHER TEAM's truck rebuilds it (prompt 70 — no ownership
  concept, and the tug-of-war is the point; if instant rebuilds prove
  too cheap the lever is repair TIME, not rights). Bridges are NOT
  sites: they own nothing, project no supply or sensors, and never count
  toward the ticket majority. AI siege/repair doctrine is deferred to
  13E-2 and carries its own sweep.
- **Map roster (prompt 60)**: specs/10_map_roster.md is the map design
  of record — checklist audit, hard profile constraints (mirror,
  shared bases/road, west-gen, runway), maps 3 `blackwood` + 4
  `sawtooth`, a 6-map bank, and the per-map promotion gate
  (experimental MAP= opt-in until a 300-war PC battery passes).

## Pacing & victory (BF2-study rulings, 2026-07-28)

- **Ticket bleed (13H): HYBRID** — relay majority bleeds enemy tickets
  (pool ~300, majority threshold, ~1/2 s — sim-tuned); empty pool =
  loss; the points-horn stays as backstop.
- **Field respawn (15F): crewed carriers only**, per-operator cooldown.
- **Lateral relays**: frontier gains two mirrored pairs on the trail
  loops — (44,40)/(83,40) and (44,86)/(83,86) — an 8-relay conquest web.
- **AT satchel (LANDED, 16f)**: one per bail-out (hashed), adjacent,
  60 damage, single-use, loud (event + auto team ping), kill credit to
  the operator; click an adjacent enemy while downed to plant.
- Forced respawn at base after a 10 s countdown (playtest 7 item 15);
  the abandoned hull stays in place and SELF-RECALLS — 60 s uncrewed in
  the field auto-wrecks it (towable/rebuildable). Carrier field-respawn
  cooldown: 30 s per operator.

- **12F POW release (prompt-56): RAIDABLE HOLDING SITE** — POWs held at
  the captor's base depot; a friendly hull reaching it frees them
  instantly; rescue raids become a mission card.
- **14F audio (prompt-56): SYNTH FIRST** — WebAudio patch manifest per
  chassis×event; samples may drop into the same manifest later.

- **Weather fronts (16G, LANDED — gameplay-evolved #4b)**: once per
  war, seed-scheduled (pure function, mid-war band, 90 s), every sensor
  halves for both teams; edges announce themselves. No hashed state.
- **Gameplay-evolved triage** (prompts 57/57-ext): build candidates
  ruled/queued — weather ✅, bridges, salvage, Last Convoy, meaningful
  deaths (B1), mercy/overtime (B3), node classes (B2), awards+recap
  (B4/B7), comm wheel (B5), neutral drop (B6); ~30 idea-bank entries in
  reports/2026-07-29_gameplay_extensive_eval.md.

## AI doctrine rulings

- AI regents crew every empty seat; role ladder and errands in
  specs/09_ai_regency_doctrine.md.
- **Escort doctrine (item 11, ruled): BOTH triggers** — the carrier
  raids with ≥2 combat escorts moving alongside (~6 cells), OR through
  a sneak window (enemy strength near the route under threshold);
  aborts if escorts die mid-run.
- AI pings sparingly (one per seat per 30 s); regents mine near owned
  relays, clear marked mines, shoot pestering drones.

- **Underdog premium — faction AND map (prompts 58 + 68, FUTURE
  profiles/ranking)**: global ranking points and honors scale UP for
  whichever side carries the measured disadvantage — harder challenge,
  more reward. Two axes, same mechanism:
  - FACTION: the faction with the lower measured win rate (currently
    the Outliers).
  - MAP/SIDE (prompt 68): on a profile that measures a persistent lean,
    the disadvantaged team earns the premium ON THAT MAP.
  Both derived from live sweep data, never hardcoded, so they
  self-correct as balance shifts — and so a premium can never be farmed
  by picking the "weak" side once it stops being weak.
  CONSEQUENCE FOR THE MAP GATE: a measured lean no longer automatically
  disqualifies a profile. A map may ship EXPERIMENTAL-with-premium while
  tuning continues, provided the lean is (a) measured at sweep scale,
  (b) disclosed in specs/10, and (c) not so large that the disadvantaged
  side stops being fun to play — the premium pays for a hard fight, not
  for a hopeless one.

## Presentation & platforms

- Painted low-poly hybrid; diorama read. Title/copy rules in
  specs/title-and-naming.md (Fireline Command).
- Baked sprite sheets + 2D canvas fallback (WebGL-absent), minimap
  icons seeded from them; fps-floor auto-engage awaits GPU perf data.
- Mobile touch = skin over drive intents; i18n total (en/no).
- Global discovery: adopt the sibling master-server pattern
  (specs/game-discovery.md) — announce/probe/list, probe-before-list,
  checksums in the announce; reconnect banner precedes it (landed).
  Master index COLOCATES on the game VM; its own server is listing #1.

## Session & infrastructure

- **Map rotation & voting (prompt 63, FUTURE — with the map roster and
  the server-community wave)**: a server option chooses between RANDOM
  rotation and END-OF-ROUND MAP VOTE. Voting shows each candidate as a
  MINIMAP THUMBNAIL (the profile generator is pure, so a thumbnail is
  cheap and honest — same cells the war will use); random rotation
  shows the NEXT MAP on the end screen instead of a vote. Server-only
  authority as with every session rule, so replays stay honest. Depends
  on: the roster having enough promoted profiles to be worth choosing
  between (specs/10), plus a thumbnail renderer.
- Session rules hashed in state (13F); replays re-simulate the same law.
- Every gameplay slice ends with the backend sim gate; balance claims
  need sweep-scale data (local 300+, PC 600+).
- Batch PC runs sweeps via agent-mail; results return as CSV mail;
  worker self-updates via the `update` job.

## Open design questions from playtest 8

- **Should seat swapping require a base/site? (item 22, UNRULED)** The
  player expected "Next asset" to work only inside a base area. The
  ENGINE has no such restriction today — `select_asset` is legal
  anywhere, and the AI crewing ladder (a freed seat picks the best
  available hull, wherever it stands) depends on that. Adding the
  restriction is a gameplay change with sim consequences, not a UI
  tweak, so the client currently greys the button only for conditions
  that genuinely block a selection (downed, respawning, aboard, nothing
  free). If the rule IS wanted: it needs a reducer gate, an AI doctrine
  answer for field re-crewing, and a sweep to confirm tempo survives.
