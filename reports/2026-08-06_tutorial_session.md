# Session report — 2026-08-06 (prompts 192-199): tutorial + playtest fixes

## What shipped

| Slice | What |
|---|---|
| W4-12 tutorial | First-timers get INTRO ("Looks like it's your first time") → 7-stop arrow TOUR of the real HUD → 12 field-exercise QUESTS completed by real play. SKIP TUTORIAL lower-right throughout (falls back to the O3 coach beats); per-step skip; ⚙ "Replay tutorial". Client-only, nothing hashed. |
| HUMAN-RESERVE LAW (195) | Your playtest stuck-state: 17 hulls serve 16 seats, and after your wreck the AI ladder took the spare then won the race to every factory wave — you spectated your own war behind honest-but-silent UI. Regents now claim only what waiting humans don't need (takeover seats excluded, within-tick counter, both claim sites); the bodiless seat NAMES its state (respawn countdown / pick a hull / hull reserved for you). Inert in AI sims. 7 tests, 5-seed gate healthy. |
| YOU-marker embodiment (196-197) | The green diamond was a child of your driven hull — it died exactly when you left it. One scene-level marker now follows whereAmI (driving/stationed/riding/downed), the downed figure is terrain-anchored (it SANK into relief at fixed y=0.05 under ~0.11 undulation — why you never saw a body), and your body's first appearance fires the locator ring. Acceptance pins the marker. |
| /healthz + real version (198) | `/healthz` aliases `/health` (both siblings speak only /healthz — box sweeps missed us); `/health` falls back to package.json version instead of `"dev"`. Live after your next deploy. |
| Prompt recovery | dev-prompts.md was missing the deploy-session prompts — 187-192 recovered verbatim from the session transcript, grouped to match the commit citations. |
| W4-13 planned | Your golden mission-line directive — recommended client-first shape in plan-wave4.md; Q91 (mode steps vs the vote cycle) + Q92 (difficulty ramp) block the build. |

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

## Follow-ups before/at your deploy

- **Deploy ships four slices**: tutorial (W4-12 + locale fix),
  human-reserve law, embodiment marker, /healthz+version. After deploy,
  `curl https://fireline.kjell.today/healthz` should answer with
  `"version":"0.12.0"` — that IS the verification the new build landed.
- On the box (yours): `sudo ss -ltnH "sport = :8131"` bind verify.
- Record port 8131 in the sibling's `ops/multi-game-hosting.md`; add
  Fireline to games.json in the games-index repo.
- multiciv/ssh-deploy.sh still has the broken `grep -w ":$p"` port check.

## Playtest focus (round 2)

1. Get shot down ON PURPOSE: you should see your prone body (terrain-
   anchored now), the green ring pulse on it, and the diamond above it.
2. Respawn with all hulls taken: the status panel should count down,
   then either point you at a free hull or promise the reserved wave
   hull — which the AI must actually leave for you.
3. Resume the tutorial ladder from wherever you left it (it never
   dead-ends: every state-dependent quest has "skip this step").
4. The four feel-questions in dev-questions.md (arrow placement, quest
   pacing, ✓ rhythm, tour clarity).

## Open questions

- Q85-Q92 live in dev-questions.md (tutorial protection, deploy timing,
  heist bar, raid census, wave-4 tail order, public how-to-play, golden
  mission-line design x2).
- W4 remaining: W4-9 careers, W4-11 Frontline Push, W4-13 golden line.
