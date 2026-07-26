---
name: review-round
description: The user's periodic "do docs/memories/skills/tests need updates?" checkpoint — the checklist of what lives where and what usually drifts. Run it whenever that question (or a variant) arrives.
---

# The review round

The user asks this after every few slices. Answer by DOING, not listing:
make the updates, close small test gaps on the spot, then report what
changed. Only genuinely new artifacts (a skill, a big doc) need asking.

## What lives where (drift checklist)

| Artifact | Drifts when | Fix |
|---|---|---|
| `CLAUDE.md` (repo) | new engine modules, commands, invariants, roster shape | keep the module map + command list + invariants current; this is what future sessions read FIRST |
| `RUNNING.md` | any player-facing feature (keys, modes, maps, units) | one bullet per feature, written for the playtester |
| `plan-implementation-order.md` | slices land or get re-scoped | ✅ marks + a "next slices" section |
| `reports/<date>_*.md` | every working session | the user reads THESE on return — slice table, findings, numbered questions (keep numbering monotonic across the session) |
| `dev-log.md` | every slice | already habitual |
| `dev-prompts.md` | every user prompt, verbatim | GITIGNORED by the user's choice — on-disk only |
| Memories (`~/.claude/.../memory/`) | project state changes shape (branch, fixture version, open questions, big invariants) | update the existing file; keep MEMORY.md one-liners current |
| Skills (`.claude/skills/`) | a WORKFLOW repeats or a checklist drifts (e.g. new-chassis contract fields) | update in place; new skill only for a genuinely recurring new workflow |
| `data/units.json` | any units.js change | regenerate (one-liner in dev-log 11A) |
| Asset strip PNG | any factory/manifest change | `node tools/build_assets.mjs && node tools/render_asset_strip.mjs`; strip-width pin in art_pipeline.test.js |

## Test-gap heuristics (what has actually bitten)

- **Cross-system combinations**: each system is tested alone; pairs bite
  (direct-drive × mines, carrier × capture-instant-score, tow × repair
  bay). After a new system lands, ask "what does it touch?" and test the
  two most dangerous intersections.
- **ws-level echoes**: every new command needs ONE over-the-wire test —
  the transport spreads operatorId, and validate() shape bugs hide there.
- **Roster sweeps**: contract tests that iterate ALL chassis/layouts (the
  mirror-invariant and garage-selectable sweeps) catch future additions
  automatically — prefer them over per-unit tests.
- **Sandbox traps** (recurring): whole-map default bases = instant
  supply/scoring/repair; single-relay maps = domination during long
  loops; lone assets = elimination freezes; slow chassis need longer
  loops (off-supply halves speed). Check these before debugging "engine
  bugs" in tests.
- Suite counts are double-run; ws tests use poll-waits, never fixed
  settles under load.
