# Fireline Command — Version 3 Plan (the LIVE-SERVICE era)

*Created 2026-08-07 (prompt 218). HTML twin: `plan-version3.html` —
keep both in step. V2 (`plan-version2.md`) is effectively CLOSED: the
game is live, onboarded, mobile-playable, fair on the default map both
worlds, and instrumented. V3 is what makes it a game strangers RETURN
to. Rulings feed `specs/07`; working questions in `dev-questions.md`.*

**The V3 thesis:** the engine and fairness campaigns are done; the
remaining value is in PEOPLE (careers, discovery, growth), the THIRD
MODE, closing the last balance residuals, and the presentation that
makes the homage sing. Every slice keeps the V2 laws: nothing hashed
without the paired-hash rule, sim gate on gameplay, lints before
gates, batteries on the PC lane.

## Track 1 — People & persistence (FIRST: ruled Q89)

| Slice | Shape | Status |
|---|---|---|
| **W4-9 Operator careers** | Server-side persistent record per playerId (wars, deeds, honors, gold-line completion) in STATE_DIR — NOT hashed, transport-served; client career card on join + end screen | 🔜 NEXT BUILD SLICE |
| Name reservation | A name sticks to a playerId once used (collision → suffix); pure transport | with careers |
| Career-aware honors | "First war" / "100th tow" callouts from the record; client-only flourishes | after careers |
| Leaderboard page | /careers.html static-served, reads a public careers endpoint (privacy: names only, opt-out flag) | after careers |

## Track 2 — The third mode (ruled Q81: final-pair hold)

| Slice | Shape | Status |
|---|---|---|
| **W4-11 Frontline Push** | `rules.mode=3`: relays lock into the road-spine SEQUENCE, only the active pair capturable, front advances/recoils; win = hold the enemy's final pair 60 s or stall-clock tickets | ⬜ full slice chain (engine → AI doctrine → cards/banner → battery lane `batch_send.sh push`) |
| Push AI doctrine | Attack/defend the active pair — capture-seek retargeted; symmetric mode (no MODEATTACKER) | with the slice |
| Vote entry | Third-slot rotation with convoy/heist/night per the Q54 ballot law | last |

## Track 3 — Balance closure (the last residuals)

| Item | Instrument | Status |
|---|---|---|
| **Map promotions** | 3 batteries on HEAD (sawtooth/riverline/caldera) + owner feel-checks → COMPLETED_MAPS | 🔜 FIRST PC-LANE SLATE |
| Standoff-breaker verification | Convoy battery re-run (`batch_send.sh convoy`, escorts press deep by design) + a STANDOFF=0 A/B if standard-war tempo reads slow (5-seed gate showed 2/5 horn endings) | with the slate |
| **Raid-party census** | hulls committed/lifetime/losses-while-live/rebuild timing per team; names the POWS=2 residual | queued SECOND (ruled Q88) |
| **Siege prep** | The heist lever (ruled Q87 GO): attacker pre-war emplacements; target 25-40% attacker | after census |
| MPG wave-timing | B refills earlier despite fewer losses — instrument then fix | filed |
| East-pusher residual | +7-13 side-keyed | filed |
| The 6-map bank | archipelago, rail junction, urban grid, salt flat, highland ridge, fortress breach — one at a time, full promotion gate each | as demand grows |

## Track 4 — Presentation & the homage

| Item | Shape | Status |
|---|---|---|
| **Music integration** | Composer's 12-track brief delivered; bus + toggle already ship; integration slice on delivery | ⏳ external |
| Chase-cam polish | The homage's missing feel: low camera glued behind the hull in direct mode | ⬜ |
| Arcade HUD (direct mode) | Speed/heading strip, hit markers, tighter reticle | ⬜ |
| Detail era phases 4-5 | Unit detail pass + atmosphere (dust, wind, night lighting beyond the dimmer) | ⬜ |
| Compound life | More building variety on the (now open) spawn strip sides; guards patrol paths | ⬜ |

## Track 5 — Live service & growth

| Item | Shape | Status |
|---|---|---|
| Host decision | Probe candidates with tools/host_probe.mjs; migrate if the shared box disappoints (the FULL nginx/cert story redoes on a new box — see deploy-new-sibling-game-in-box-dos-and-donts.md) | ⏳ user probing |
| Monitoring sweep | Cron a /healthz sweep (rssMb + tickJitter + version) across the box's games; alert on drift | ⬜ small |
| Multi-server discovery | The master index exists (15H); a second live server (EU/NA or map-dedicated) exercises it for real | ⬜ when players warrant |
| Session telemetry | /metrics + netDiag + tickJitter → a daily digest (wars, players, drops, verdicts) | ⬜ V3.x |
| O8 second half | Uncapped + weak-hardware (MX550) perf runs | ⏳ user-side |

## Sequencing

1. **PC lane now**: promotion batteries ×3 → census.
2. **Build now**: W4-9 careers (small, warms the live site).
3. Then: siege prep (battery-gated) → W4-11 Frontline Push (the big one).
4. Presentation interleaves as externals land (music) and playtests demand.
5. Growth items ride player numbers — none block the game.

## What V3 deliberately does NOT include

- Text chat (pings + wheel are the ruled design — O7 closed).
- Accounts/passwords (playerId + name reservation is enough at this scale).
- The Roblox/Luau twin (horizon, unchanged).
- New factions/chassis (the 10+2 roster is complete; balance first).
