# More Firepower

A deterministic, server-authoritative multiplayer wargame inspired by the 1987
classic *Firepower* — a new IP, not a clone. Players drop into an active war
(no lobby), take command of a tank, scout, or artillery piece, and fight for
relay sites that project the supply lines both teams live on. AI regents keep
the war moving when humans leave; every war replays byte-exactly from its
command log.

**Status: v0.9.0 — feature-complete for v1, 199/199 tests green.**
Remaining before v1: manual browser/LAN acceptance and the gaps listed in
[`plan-version1.md`](plan-version1.md). Art direction is deliberately still
open (placeholder meshes and synth audio).

## Quick start

```bash
npm install
npm test        # full suite
npm start       # http://localhost:8080 — join the war
```

See [`RUNNING.md`](RUNNING.md) for LAN play, Docker, headless sims, and ops
endpoints.

## Reading order

| File | What it tells you |
|---|---|
| `RUNNING.md` | how to run, test, and play |
| `plan-version1.md` | what's still missing for a fully playable v1 |
| `dev-log.md` | the slice-by-slice rebuild history (marker-NNNN ↔ git commits) |
| `dev-prompts.md` | the verbatim product decisions this build follows |
| `CLAUDE.md` | working rules: determinism, slice workflow, fixture policy |
| `specs/` | original design documents (see historical note in the retrospective) |

## Architecture in one paragraph

One pure reducer — `apply(state, command) → nextState` — owns every outcome:
movement, combat, fog, supply, capture, victory. `shared/` holds canonical
byte serialization, FNV-1a 64 hashing, and the deterministic PRNG; `engine/`
holds the reducer, map profiles, LOS, AI regency, and the headless
`GameServer`; `server/` bridges it to WebSockets, static hosting, and the
replay store; `client/` renders fog-filtered views with three.js and only
ever *proposes* commands. Tests are the contract: byte-exact fixtures pin the
shared layer, milestone tests pin every slice, and soak tests replay whole
32-participant wars hash-for-hash.

## A note on `phases/` and `initial-prompt.md`

Those folders document the original prototype hand-off. The claims inside
("v0.7.0, feature-complete, 198 verified tests") describe an assembly whose
core engine layer was lost; the code there descends from a degraded fork and
is kept as design reference only. The rebuilt tree in this repository root is
the verified implementation — see `dev-log.md` marker-0001/0002 for the full
story.
