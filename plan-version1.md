# More Firepower — Version 1 Plan & Status

*Updated 2026-07-26 (marker-0037). HTML twin: `plan-version1.html`.
History of the original gap analysis: git log of this file / `dev-log.md`.*

## Where v1 stands

**v0.11.0 — 272/272 tests.** The core fantasy is in and playtested: physical
Command Standards (steal → escort → drop → rescue → score, first capture wins),
automatic war rotation, wreck tow-back recovery (now a **Logistics Truck**
role), reducer-enforced fire cooldowns, relay supply projection, fog, AI
regency with drop-in/drop-out, byte-exact replays, and a manifest-driven
art pipeline awaiting painted models.

| Acceptance check | Result |
|---|---|
| Headless: 32-participant war, replay byte-exact | PASS (automated, `npm run simv1`) |
| LAN playtest 1 (2 humans) | Technical PASS; experience FAIL ("made little sense") |
| Fix slice: pace ×2 + legibility kit | Shipped (markers 0034/0035) |
| LAN playtest 2 | **PASS** — "hint actually leads you somewhere useful: YES; ×2 pace felt right" |

## The roster (decided: spec "middle path")

| Chassis | In engine | Role | Notes |
|---|---|---|---|
| Tank (≈ Assault Vehicle) | ✅ | direct combat | speed 32, dmg 20, reload 15 |
| Scout (≈ Scout Buggy) | ✅ | recon/harass | speed 56, fragile |
| Artillery | ✅ | indirect fire w/ spotter | our addition, not in spec roster |
| **Logistics Truck** | ✅ *new* | **only chassis that tows**; lightly armed | speed 40, 3 per team in reserves |
| Command Carrier | ⬜ later | standard escort/transport, POWs | will take over standard-carrying |
| Sentinel (Warden unique) | ⬜ later | deployable area denial | needs faction system |
| Infiltrator (Freehold unique) | ⬜ later | amphibious EW raider | needs water terrain + sensors |

Until the Command Carrier exists, any chassis may carry the standard.

## Remaining before calling v1 done

**P1 — this is the short list now:**
1. **Balance pass from real sessions** (designer P1-G): play with the
   objective loop + truck role, then run `/playtest-report` against
   `/metrics` + replays. Watch: war duration, capture attempts vs scores,
   tow usage, "reloading"/"out of supply" rejection rates.
2. **Playtest 3 with a full loop attempt**: steal a standard, lose a unit,
   tow it back, win or lose a war, and let rotation carry you into war two.
3. Any P0 bugs those sessions surface.

**P2 — valuable, not blocking v1:**
- Art Slices B–E (painted GLBs for standard + unit kit incl. truck, order
  markers, canvas sprite fallback) — pipeline is ready, models drop in with
  zero code changes (`assets/PIPELINE.md`).
- Camera/perspective pass — playtest 2: current view reads as "low-poly
  Syndicate with tanks"; art spec §3 wants a 35–55° diorama feel.
- **Direct tank control mode (Firepower homage)** — user-requested option
  for later: client-side input mode (held keys → continuous short move
  orders + aim-fire). No engine change needed; needs a feel/command-rate
  design pass.
- Replay viewer, second map profile, mobile controls, persistent
  profiles/leaderboard, onboarding tooltips (7D), i18n/accessibility (7A/7B).

## Post-v1 roadmap (unchanged decisions)

Lobbies/matchmaking (5E), campaign (5D), biomes/rotation variety (5C),
telemetry (6B), modding/map editor (6E), achievements (7C) — see
`dev-log.md` marker-0019 and `specs/future/FUTURE_ROADMAP.md`.

## Definition of done for v1 (restated)

1. Two humans on LAN + AI regents play a complete war — contest relays,
   steal a Command Standard, lose/rescue assets via the Logistics Truck,
   reach the end screen — then keep playing the next war without touching
   the server. *(All mechanics shipped; needs the playtest-3 confirmation.)*
2. A newcomer understands where they are, what they drive, and what to do
   inside 60 seconds. *(Briefing + auto-crew + objective strip + labels
   shipped; playtest 2 says the hint leads somewhere useful.)*
3. `npm test` green; every mechanic hashed, replayable, fixture-pinned.
   *(272/272.)*
