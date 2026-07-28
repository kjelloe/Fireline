# Fireline Command — Design Rulings Register

**Status:** Living document. Every gameplay-affecting design ruling made
during development, in one durable place. (The verbatim prompt log is a
local-only file by choice; this register records the *decisions*.
`dev-log.md` records how each landed.)

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
  swap gate closed at 54.5% Sentinel-side. Default wars carry the
  sanctioned ~55/45 Directorate lean; designer may tighten the band
  (levers: affinity value, Sentinel mobile-hp).

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

## AI doctrine rulings

- AI regents crew every empty seat; role ladder and errands in
  specs/09_ai_regency_doctrine.md.
- **Escort doctrine (item 11, ruled): BOTH triggers** — the carrier
  raids with ≥2 combat escorts moving alongside (~6 cells), OR through
  a sneak window (enemy strength near the route under threshold);
  aborts if escorts die mid-run.
- AI pings sparingly (one per seat per 30 s); regents mine near owned
  relays, clear marked mines, shoot pestering drones.

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

- Session rules hashed in state (13F); replays re-simulate the same law.
- Every gameplay slice ends with the backend sim gate; balance claims
  need sweep-scale data (local 300+, PC 600+).
- Batch PC runs sweeps via agent-mail; results return as CSV mail;
  worker self-updates via the `update` job.
