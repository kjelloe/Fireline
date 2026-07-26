# More Firepower — Version 1 Plan & Status

*Updated 2026-07-26 (branch `dev_night`, suite 416/416, fixture v30).
HTML twin: `plan-version1.html`. History: git log of this file / `dev-log.md`.*

## Verdict: **VERSION 1 SHIPPED — and overtaken the same day**

The v1 definition — a playable full game for up to 32 players, humans and
AI, over LAN, no lobbies — was met at tag **`v1.0`** after playtest 3.
The night session and the following day then shipped most of what this
file used to call "later". This document is now the record of what v1
became; the living roadmap is `plan-version2.md` and
`plan-implementation-order.md`.

| Acceptance check | Result |
|---|---|
| Headless 32-participant war, byte-exact replay | PASS (`npm run simv1`, suite-enforced) |
| LAN playtest 1 | technical PASS, experience FAIL ("made little sense") |
| Pace ×2 + legibility kit | shipped |
| LAN playtest 2 | PASS ("hint leads somewhere useful; ×2 pace felt right") |
| LAN playtest 3 | PASS → **tagged `v1.0`** |
| Playtest 4 (post-Rescue-Update) | "Starting to get more fun" — 4 UX fixes shipped same day (11U) |
| AI-vs-AI wars end decisively | PASS — standard captures ≈ 6 min on frontier, 5-seed verified |

## What v1 contains today (far past the original cut)

- **Core fantasy**: physical Command Standards (steal → escort → drop →
  rescue → score, first capture wins), automatic war rotation, BF2-style
  capture countdowns with contested-freeze, relay supply projection, fog.
- **The Rescue Update**: carrier-exclusive standard carrying, FULL
  walking downed operators (crawl / redeploy / carrier rescue /
  delivery), truck-only tow-back recovery, Minimum Playability
  Guarantee, mines, the anti-camping drone, authoritative per-chassis
  turn-rate movement.
- **A roster of seven**, every capability an explicit contract flag:
  tank, scout, artillery (the only siege gun), logistics, command
  carrier, scout bike (courier — cannot capture or contest), mortar
  carrier (mobile indirect).
- **A living world**: AI regency with computed roles (raider, recoverer/
  courier, capturers, fire support), AI mining, mine-clearing, towing,
  rescuing, repairing, and pinging; light chassis patrol the trails.
- **Coordination**: context pings (team-scoped events), fog-safe public
  task cards, takeover confirmations, the rescue-autopilot option,
  Recognition scoring with end-screen honors.
- **Modes & tooling**: direct control for all chassis with aim-assisted
  fire, spectator seat, local-resimulation replay viewer, two
  mirror-fair maps (frontier corridor, riverline), path terrain, ops
  hardening (rate limits, /version), the batch-PC job lane and sim
  harnesses.

## The invariants that made it work

1. Deterministic pure reducer, integer math only; hashed state pinned by
   the 1A fixture (v30) whose event-drift guard has repeatedly refused
   bad changes.
2. **Mirror symmetry is a balance invariant**, enforced by test for
   every map layout — the "one team wins 5/5 seeds" era traced to a
   3-cell spawn asymmetry and an un-mirrorable center relay.
3. Every gameplay slice ends with the AI-only sim gate (`sim-campaign`
   skill); every product decision is the user's, recorded verbatim in
   `dev-prompts.md` before implementation.
