# Wave 4 — the FUN wave (ruled prompt 174; PLAN ONLY, nothing implemented)

The design-review slate, all approved: co-op-by-default onboarding,
surfacing the hidden systems, feel/juice, smoke, the UAV sweep test,
and two bigger swings (night wars, Frontline Push). Every slice below
names its layer, hashed-state impact, tests, and gate. Sequenced so
schema repins batch and the cheap wins land first.

## W4-1 · Team balance OFF by default (S) — ✅ SHIPPED (prompt 175)
### RULED Q77 (prompt 175): no button change — unrestricted same-team joining

- The join screen stays EXACTLY as it is (two faction flags). The
  2-human balance gate becomes a SETTING, default OFF: friends stack
  a team freely and the Regency holds the other side.
- `TEAMBALANCE=1` / `--teambalance` restores the gate for competitive
  hosts. s_lobby carries the setting so the client only greys/locks
  buttons when balance is actually enforced (head-counts still shown).
- Nothing hashed changes (the gate lives in the transport; AI already
  fills all empty seats). Mirror batteries untouched.
- Tests: lobby test — gate refused-join case moves under
  `{teamBalance: true}`; new default-case test pins unrestricted
  stacking. RUNNING/DEPLOYING note the flag for competitive hosts.

## W4-2 · Rookie drone grace (S) — ✅ SHIPPED (fixture v69)

First battle = no anti-camping drone, per the mf_coached ruling.
- Client sends `rookie: !localStorage.mf_coached` on join → operator
  field `rookie` (HASHED — repin) → the drone pass skips assets whose
  operator is a rookie, for that war only.
- Trust caveat (accepted): a client can lie; the drone is anti-camp
  QoL, not competitive integrity — and in co-op-default it mostly
  protects new players from the AI's own umbrella.
- Complement: a coach beat at ~20 s idle-out-of-supply ("drone
  incoming — MOVE") for everyone, so war two isn't a cold shock.
- Tests: reducer test (rookie asset never targeted; veteran is), ws
  echo of the join flag. Gate: 5-seed sim (AI ops are never rookies —
  sims unchanged).

## W4-3 · Mission cards: the hidden systems (S) — ✅ SHIPPED (client-only, no event needed)

- "A POW IS HELD AT THEIR PRISON — raid it" (team knows its own
  captured operator; card targets the enemy prison; appears when
  `operators[i].state === OP_CAPTIVE` for your team).
- "THE LANDSHIP STANDS UNCLAIMED — claim it" (neutral + uncrewed is
  common knowledge; card until first capture, again when it respawns).
- Card kinds + strings both locales; click-to-jump + auto-ping like
  existing cards. Pure client derivation from fog-legit state — no
  hashed change.

## W4-4 · Placement ghost (S-M) — ✅ SHIPPED (reuses the engine law, not a mirror; exposed a dead sandbag button)

Green/red build preview before the channel, for sandbags (two-lane
law), caltrops, and mines.
- `client/js/build_model.js`: pure placement-verdict mirror of
  engine/sandbags.js + mine/caltrop placement rules (the fog_model
  precedent) — agreement pinned by a parity test that sweeps cells.
- Renderer: hover ghost tile tinted by verdict; invalid shows the
  reason in the status panel ("road must keep two lanes").
- No engine change. Acceptance item: ghost appears, flips tint across
  a known-illegal cell.

## W4-5 · Direct-control juice (S-M) — ✅ SHIPPED

The homage's feel layer: camera kick on own gun (2-3 px, 100 ms),
tracer streak on direct-mode shots, muzzle flash scale by chassis,
hit-confirm tick (sfx bus patch exists), subtle engine-pitch shift
with throttle. All behind the visuals tier (Low skips shake).
Acceptance: direct-mode fire produces tracer + shake hooks; smoke
gate stays clean.

## W4-6 · Smoke screens (M) — ✅ COMPLETE (truck-laid + mortar alt-fire + SMOKE=0; battery pair queued)

The measured counter to artillery farming (the mid-war ledger).
- `engine/smoke.js`: hashed `smokes` [{x, y, expiresTick}] — REPIN.
  Radius 1 patch per deployment (a "few cells" = lay 2-3), ~30 s
  (`rules.smokeTicks` = 750, tunable), cap per team live (say 6).
- Deploy paths: **mortar alt-fire** (`fire` with `smoke: true` at a
  target cell in range — consumes the reload + 1 ammo, indirect arc)
  and **truck-laid** (`deploy_smoke` on own cell, 2 s channel — the
  sandbag pattern without terrain mutation).
- LOS: a sight line crossing a smoke cell stops there (los.js;
  fog_model mirrors it — parity test). Units inside smoke see 1 cell.
- v1 is HUMAN-ONLY (no AI doctrine — the getaway lesson); SMOKE=0 /
  `rules.smoke` kill-switch from day one; a same-build battery pair
  proves inert-when-unused, and an AI-doctrine rung (defensive smoke
  under shellfire) is a later, separately-measured slice.
- Tests: placement/expiry/cap, LOS block both sides, mirror-pair
  equivariance (smoke at x mirrors to W-1-x), fog parity, ws echoes
  for both commands. Gate: sim (unused = byte-inert) + battery pair.

## W4-7 · UAV sweep — the recognition sink TEST (M) — ✅ SHIPPED (fixture v71; PvP default + battery remain)

- Command `call_uav {cellX, cellY}`: costs recognition (default 25 —
  **Q79**: confirm the price), reveals fog radius 8 for 10 s to the
  caller's team. Hashed `uavSweeps` [{team, x, y, expiresTick}] —
  same repin batch as W4-6.
- Economy honesty: deeds and HONORS judge recognition EARNED (running
  total untouched); spending draws from a separate `recogAvailable`.
  The scoreboard shows earned; the call-in button shows available.
- RULED Q79 (prompt 175): price 25; ON when team balance is off
  (the co-op posture), OFF in balanced/PvP wars until a battery says
  otherwise (`rules.uavSweep`, UAV=0).
- los.js + fog_model parity again; ws echo; ammo-style rejects
  ("not enough recognition").

## W4-8 · POW-creating events (M) — ✅ SHIPPED (all four; measurement is a NULL in AI wars — see Q84)

Today the only creator is scout abduction of downed crew. The ruled
question — which events should create POWs — my slate:

| Event | Mechanism | Verdict |
|---|---|---|
| **a. Failed heist** (your suggestion) | The Asset carrier is disabled inside the defender's half → its operator is CAPTURED, not downed (the vault's guards take them). Sharp, thematic, mode-scoped | **Recommend** |
| **b. Deep-down capture law** | A downed operator whose down-timer expires inside the enemy COMPOUND (base rect — the compound-watches-itself precedent) becomes captive instead of redeploying | **Recommend** — organic standard-war POWs with existing machinery |
| c. Failed prison raid | Raiders downed inside the prison's raid radius while the alarm is live → captured | Good flavour; adds risk to raids — second wave |
| d. Convoy driver | The convoy truck's driver, if the wreck sits undefended 60 s, is captured | Maybe — convoy already has the restart law; could double-punish |
| e. Boxed-in surrender | Surrounded + out of ammo = crew surrenders | Against the fights-on grain — do not recommend |

RULED Q78 (prompt 175): **a, b, c, d all land** (e rejected). One per
mode (a), one universal (b), raid risk (c), convoy capture (d — the
double-punish caveat was noted and overruled; keep the 60 s
undefended window generous so the restart law still matters). All
use `OP_CAPTIVE` + prisons exactly as built. Hashed impact: none new
(state transitions only) — but the event stream changes, so reducer
tests pin each new transition. The abduction counterplay law
(suppression pauses) applies wherever sensible.

## W4-9 · Persistent operator record (S-M) — server + client, NOT hashed

- `data/careers.json` (runtime state, deploy-excluded): per playerId —
  name, wars fought/won, career deed totals, best honors. Written at
  war archive time (the replay-store hook), read at `/career/:id`.
- End screen: "career" line under your honors (wars, kills, rescues,
  escorts). Join screen greets a returning name.
- No engine/hash surface. Tests: ws + http roundtrip; write-once-per-
  war (the archive-once pattern).

## W4-10 · Night wars (S-M) — ✅ COMPLETE (engine + CLI + vote entry + client dimmer)

- `rules.nightWar` / `--night`: sensors ×0.5 all war (the weather
  machinery, held constant), headlight cone visual + darkened
  lighting on the client, storm-sun precedent for the dimmer.
- RULED Q80 (prompt 175): always-available `--night` flag + a vote
  pool entry so rotation surfaces it. No seed scheduling.
- Battery: night pair (should read as a symmetric sensor change —
  fairness invariant by construction, verify anyway).

## W4-12 · Tutorial quest-line (M) — ✅ SHIPPED (prompt 192, client-only)

- Friend feedback (the three.js expert): first-timers get "Looks like
  it's your first time" → a 7-stop arrow TOUR of the real HUD →
  12 sequential field-exercise QUESTS detected from real play (commands
  sent, UI actions, own-view events — fog-legit by construction).
  SKIP TUTORIAL lower-right throughout; skipping falls back to the O3
  four-beat coach; per-step skip so state-dependent quests (tow,
  carrier) never dead-end the ladder. ⚙ "Replay tutorial" re-arms.
- Pure controller `tutorial_model.js` (splash_model pattern), nothing
  hashed. Two new lints (tour targets exist in index.html; tutorial
  keys in both locales) + full-flow browser acceptance.

## W4-13 · The GOLDEN LINE (M) — ✅ SHIPPED (prompt 201, owner's design)

- The owner's clarified shape replaced the scripted-ladder sketch: the
  REAL mission cards wear gold (★ + glow + tooltip) for every kind
  this player has never tried; clicking the card — fly there, answer
  it — retires that kind's gold forever (`mf_goldline`, cross-war).
  Veterans age out naturally; no server coupling, so the old Q91/Q92
  (vote-cycle + difficulty-ramp questions) dissolved unasked.
- Follow-up candidates if playtests want more: deed-based retirement
  (gold clears on DOING, not clicking) and a progress count in ⚙.

## W4-11 · Frontline Push — the third mode (L) — full slice chain

- `rules.mode = 3` (MODE=push): relays lock into a SEQUENCE (the
  road spine, west→east pair by pair); only the ACTIVE pair is
  capturable; capturing advances the front and unlocks the next
  pair; the defender recaptures to push back. Win: hold the enemy's
  final relay pair for 60 s, or tickets on the stall clock (the
  stalemate-attrition precedent).
- Shows off supply: the front IS the supply edge as it moves.
- Needs: mission.js extension, AI doctrine (attack/defend the active
  pair — the capture-seek machinery retargeted), mission cards, mode
  banner, `batch_send.sh push` battery lane, MODEATTACKER n/a
  (symmetric mode — both push).
- RULED Q81 (prompt 175): FINAL-PAIR HOLD — hold the enemy's last
  relay pair for 60 s to win; tickets on the stall clock otherwise.
- Last in the wave: biggest, and it inherits every fairness law the
  wave hardens.

## Sequencing & measurement discipline

1. W4-1 co-op (the onboarding win, zero engine risk)
2. W4-2 rookie grace ┐
3. W4-6 smoke        ├─ ONE fixture repin batch (schema fields land together)
4. W4-7 UAV sweep    ┘
5. W4-3 cards, W4-4 ghost, W4-5 juice (client track, parallel-friendly)
6. W4-8 POW events (after Q78), W4-9 careers, W4-10 night
7. W4-11 Frontline Push (after Q81)

Every engine slice: suite ×2, 5-seed sim gate, kill-switch from day
one, same-build battery pair before any measured claim. Client
slices: smoke + acceptance. The contact-law re-baseline slate and
POWS bisections currently on the PC lane finish first — their
verdicts (and Q74-Q76) may reorder the tail of this wave.

## Sub-rulings — ALL RESOLVED (prompt 175)

- **Q77** teambalance=off default, join screen unchanged
- **Q78** POW creators a, b, c, d land; e rejected
- **Q79** UAV: 25 recognition; off in balanced wars until a battery
- **Q80** night wars: flag + vote entry
- **Q81** Frontline Push: final-pair hold
The wave is fully ruled — implementation proceeds in the planned
order (W4-1 first).
