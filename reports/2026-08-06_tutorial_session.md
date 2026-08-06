# Session report — 2026-08-06 (prompts 192-209): tutorial, playtest fixes, ops instruments

## What shipped

| Slice | What |
|---|---|
| W4-12 tutorial | First-timers get INTRO ("Looks like it's your first time") → 7-stop arrow TOUR of the real HUD → 12 field-exercise QUESTS completed by real play. SKIP TUTORIAL lower-right throughout (falls back to the O3 coach beats); per-step skip; ⚙ "Replay tutorial". Client-only, nothing hashed. |
| HUMAN-RESERVE LAW (195) | Your playtest stuck-state: 17 hulls serve 16 seats, and after your wreck the AI ladder took the spare then won the race to every factory wave — you spectated your own war behind honest-but-silent UI. Regents now claim only what waiting humans don't need (takeover seats excluded, within-tick counter, both claim sites); the bodiless seat NAMES its state (respawn countdown / pick a hull / hull reserved for you). Inert in AI sims. 7 tests, 5-seed gate healthy. |
| YOU-marker embodiment (196-197) | The green diamond was a child of your driven hull — it died exactly when you left it. One scene-level marker now follows whereAmI (driving/stationed/riding/downed), the downed figure is terrain-anchored (it SANK into relief at fixed y=0.05 under ~0.11 undulation — why you never saw a body), and your body's first appearance fires the locator ring. Acceptance pins the marker. |
| /healthz + real version (198) | `/healthz` aliases `/health` (both siblings speak only /healthz — box sweeps missed us); `/health` falls back to package.json version instead of `"dev"`. Live after your next deploy. |
| Prompt recovery | dev-prompts.md was missing the deploy-session prompts — 187-192 recovered verbatim from the session transcript, grouped to match the commit citations. |
| Deferrable quests (200) | Artillery at the tow step no longer blocks the ladder: unattemptable quests rotate to the back with a one-time "deferred — why" note and return when conditions allow. Numbering counts done. |
| THE GOLDEN LINE (201) | Your clarified design shipped, superseding the W4-13 sketch: real mission cards wear gold (★+glow+tooltip) per kind until first clicked; `mf_goldline` persists across wars. Q91/Q92 dissolved. |
| Key bar visibility (201) | The special-quest text names the actual keys, and #hint-bar lights up while that quest is active (it was 11px dark-grey chrome — never hidden, never legible). |
| THE UNIMPORTED IMPORT (202) | The stations slice never imported getUnitStats — J-join, seat hover tips, and the station banner threw ReferenceError on first touch since 08a9b1d. Fixed + a clickable "call a gunner" banner for drivers + bunk advertising on hover + an import-reality lint (red-green verified) so the class cannot reship. |
| Searchlight anchor (203) | The sweep pivoted about mid-beam (centred ConeGeometry); apex now sits at the lamp. |
| Acceptance state-surgery (205) | The round-2 trio proven in a real browser (downed body/diamond/ring, bodiless narration, searchlight bbox) — and the surgery caught the golden-line `t` shadow crash the deployed build carried. |
| Crash + memory posture (206) | Atomic autosave (tmp+rename), V8 heap capped below MemoryMax in the unit templates, REPLAY_KEEP disk retention, rssMb on /health. Unit changed — box needs `--bootstrap`. |
| Resource profile (207) | Measured: heap ≤66 MB any map, ~1% core idle war; humans cost ~0.35% CPU + ~1 MB each (CPU, not memory). `tools/profile_run.mjs`. |
| Host instruments (208) | `/health` tickJitter digest (live steal-as-late-snapshots) + `tools/host_probe.mjs` candidate-box verdict. Shared 4vCPU/8GB analysis in the resource report. |

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

## Playtest focus (round 3)

1. NEW — seats, first honest run ever: hover a friendly carrier (tip
   should offer J for the ring / B for the bunk), and drive a carrier
   near enemies with the ring empty — the "call a gunner" banner should
   appear and click-send the ping. This UI has never once worked in a
   real session, so treat it as a fresh feature.
2. NEW — golden cards: untried mission kinds glow gold with ★; clicking
   one retires its gold permanently. Tell me if click-to-retire feels
   too cheap (deed-based retirement is the ready follow-up).
3. NEW — the tow quest in a wrong hull should DEFER (blue note) and
   come back; the special quest should light the key bar.
4. Still standing from round 2: shot-down body + ring + diamond;
   bodiless respawn narration + the reserved hull; searchlights now
   hang from their towers.
5. The four feel-questions in dev-questions.md (arrow placement, quest
   pacing, ✓ rhythm, tour clarity).

## Open questions

- Q85-Q92 live in dev-questions.md (tutorial protection, deploy timing,
  heist bar, raid census, wave-4 tail order, public how-to-play, golden
  mission-line design x2).
- W4 remaining: W4-9 careers, W4-11 Frontline Push, W4-13 golden line.
