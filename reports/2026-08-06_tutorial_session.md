# Session report — 2026-08-06 (prompt 192): the tutorial quest-line

## What shipped

| Slice | What |
|---|---|
| W4-12 tutorial | First-timers get INTRO ("Looks like it's your first time") → 7-stop arrow TOUR of the real HUD → 12 field-exercise QUESTS completed by real play. SKIP TUTORIAL lower-right throughout (falls back to the O3 coach beats); per-step skip; ⚙ "Replay tutorial". Client-only, nothing hashed. |
| Prompt recovery | dev-prompts.md was missing the deploy-session prompts — 187-192 recovered verbatim from the session transcript, grouped to match the commit citations. |

## Rulings you made (AskUserQuestion, prompt 192)

1. **Comprehensive ~12-quest ladder** (state-dependent ones per-step skippable).
2. **⚙ settings replay entry** (auto-triggers once ever; re-armable).
3. **Tutorial supersedes the coach**; SKIP falls back to the four beats.
4. **Client-side completion toast only** — honors keep judging war deeds.

## Design notes

- The server is authoritative and multiplayer, so the tutorial OBSERVES a
  live war rather than scripting one — quests complete from commands the
  player sent, UI actions, and events on their own fog-filtered view
  (fog-legit by construction; the model never sees more than the per-team
  view).
- Pure controller `client/js/tutorial_model.js` (the splash_model
  pattern) — every transition/matcher node-tested (13 tests).
- Lints BEFORE gates, both verified to bite red: tour targetIds must
  exist in index.html; every tut.* key in BOTH locales (incl. the derived
  `tut.q.<id>` the ✓ flash builds).
- ui_acceptance now walks the whole flow in a real browser: intro arms on
  a fresh profile → tour spotlight+bubble → quest handoff → a REAL Center
  click completes the camera quest (3/12 → 4/12) → SKIP persists.

## Gates

Suite 859/859 ×2 · client smoke OK · ui_acceptance OK (19 checks, 7 new).

## Carried-over follow-ups (deployment)

- On the box: `sudo ss -ltnH "sport = :8131"` bind verify (yours).
- Record port 8131 in the sibling's `ops/multi-game-hosting.md`; add
  Fireline to games.json in the games-index repo.
- `/health` says `"version":"dev"` — one-liner: pass package.json version
  into createAppServer.
- multiciv/ssh-deploy.sh still has the broken `grep -w ":$p"` port check.

## Open questions

- Q85: should the tutorial's first-war protection extend beyond the
  drone grace while quests are active (e.g. no POW capture)? Currently
  no — the war is fully real during the tutorial.
- W4 remaining: W4-9 careers, W4-11 Frontline Push.
