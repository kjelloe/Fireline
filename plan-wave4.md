# Wave 4 — the FUN wave (ruled prompt 174; PLAN ONLY, nothing implemented)

The design-review slate, all approved: co-op-by-default onboarding,
surfacing the hidden systems, feel/juice, smoke, the UAV sweep test,
and two bigger swings (night wars, Frontline Push). Every slice below
names its layer, hashed-state impact, tests, and gate. Sequenced so
schema repins batch and the cheap wins land first.

## W4-1 · Co-op mode, THE DEFAULT (S) — transport + client + docs

Humans vs the Regency is the front door; PvP is the opt-in.
- `npm start` default: co-op. The lobby balance gate is OFF; the join
  screen leads with ONE big button — "JOIN THE WAR (co-op vs the
  Regency)" — seating every human on team A; a small link underneath:
  "…or join the other side (PvP)". `--pvp` / `PVP=1` restores the
  classic two-flag screen WITH the gate.
- Nothing hashed changes (the gate lives in the transport; AI already
  fills all empty seats). Mirror batteries untouched.
- Note: humans landing on team A rides the band's upper half (54/53 A)
  — mildly rookie-friendly, worth stating in the briefing.
- Tests: lobby test (gate off in co-op, on in pvp); smoke covers the
  one-button join path. RUNNING/DEPLOYING note (unit file example
  gains `--pvp` for competitive hosts).
- **Q77 (sub-ruling)**: one-button + small PvP link (recommended), or
  keep two faction flags with the gate simply removed?

## W4-2 · Rookie drone grace (S) — engine + transport + client

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

## W4-3 · Mission cards: the hidden systems (S) — client (+1 event)

- "A POW IS HELD AT THEIR PRISON — raid it" (team knows its own
  captured operator; card targets the enemy prison; appears when
  `operators[i].state === OP_CAPTIVE` for your team).
- "THE LANDSHIP STANDS UNCLAIMED — claim it" (neutral + uncrewed is
  common knowledge; card until first capture, again when it respawns).
- Card kinds + strings both locales; click-to-jump + auto-ping like
  existing cards. Pure client derivation from fog-legit state — no
  hashed change.

## W4-4 · Placement ghost (S-M) — client + parity test

Green/red build preview before the channel, for sandbags (two-lane
law), caltrops, and mines.
- `client/js/build_model.js`: pure placement-verdict mirror of
  engine/sandbags.js + mine/caltrop placement rules (the fog_model
  precedent) — agreement pinned by a parity test that sweeps cells.
- Renderer: hover ghost tile tinted by verdict; invalid shows the
  reason in the status panel ("road must keep two lanes").
- No engine change. Acceptance item: ghost appears, flips tint across
  a known-illegal cell.

## W4-5 · Direct-control juice (S-M) — client only

The homage's feel layer: camera kick on own gun (2-3 px, 100 ms),
tracer streak on direct-mode shots, muzzle flash scale by chassis,
hit-confirm tick (sfx bus patch exists), subtle engine-pitch shift
with throttle. All behind the visuals tier (Low skips shake).
Acceptance: direct-mode fire produces tracer + shake hooks; smoke
gate stays clean.

## W4-6 · Smoke screens (M) — engine module + 2 commands + client

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

## W4-7 · UAV sweep — the recognition sink TEST (M) — engine + client

- Command `call_uav {cellX, cellY}`: costs recognition (default 25 —
  **Q79**: confirm the price), reveals fog radius 8 for 10 s to the
  caller's team. Hashed `uavSweeps` [{team, x, y, expiresTick}] —
  same repin batch as W4-6.
- Economy honesty: deeds and HONORS judge recognition EARNED (running
  total untouched); spending draws from a separate `recogAvailable`.
  The scoreboard shows earned; the call-in button shows available.
- Defaults: ON in co-op, OFF in PvP until a battery says otherwise
  (`rules.uavSweep`, UAV=0) — "test" means: land it, sandbox it,
  playtest it in co-op, and run the PvP battery before any PvP
  default flips.
- los.js + fog_model parity again; ws echo; ammo-style rejects
  ("not enough recognition").

## W4-8 · POW-creating events (M) — engine — NEEDS RULING (Q78)

Today the only creator is scout abduction of downed crew. The ruled
question — which events should create POWs — my slate:

| Event | Mechanism | Verdict |
|---|---|---|
| **a. Failed heist** (your suggestion) | The Asset carrier is disabled inside the defender's half → its operator is CAPTURED, not downed (the vault's guards take them). Sharp, thematic, mode-scoped | **Recommend** |
| **b. Deep-down capture law** | A downed operator whose down-timer expires inside the enemy COMPOUND (base rect — the compound-watches-itself precedent) becomes captive instead of redeploying | **Recommend** — organic standard-war POWs with existing machinery |
| c. Failed prison raid | Raiders downed inside the prison's raid radius while the alarm is live → captured | Good flavour; adds risk to raids — second wave |
| d. Convoy driver | The convoy truck's driver, if the wreck sits undefended 60 s, is captured | Maybe — convoy already has the restart law; could double-punish |
| e. Boxed-in surrender | Surrounded + out of ammo = crew surrenders | Against the fights-on grain — do not recommend |

a+b are the recommendation: one per mode, one universal, both using
`OP_CAPTIVE` + prisons exactly as built. Hashed impact: none new
(state transitions only) — but event stream changes, so the reducer
tests pin the new transitions. The abduction counterplay law
(suppression pauses) applies wherever sensible.

## W4-9 · Persistent operator record (S-M) — server + client, NOT hashed

- `data/careers.json` (runtime state, deploy-excluded): per playerId —
  name, wars fought/won, career deed totals, best honors. Written at
  war archive time (the replay-store hook), read at `/career/:id`.
- End screen: "career" line under your honors (wars, kills, rescues,
  escorts). Join screen greets a returning name.
- No engine/hash surface. Tests: ws + http roundtrip; write-once-per-
  war (the archive-once pattern).

## W4-10 · Night wars (S-M) — engine rules + client

- `rules.nightWar` / `--night`: sensors ×0.5 all war (the weather
  machinery, held constant), headlight cone visual + darkened
  lighting on the client, storm-sun precedent for the dimmer.
- Enters the VOTE POOL as a variant so rotation surfaces it
  (**Q80**: always-available flag + vote entry, or seed-scheduled
  every Nth war?).
- Battery: night pair (should read as a symmetric sensor change —
  fairness invariant by construction, verify anyway).

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
- **Q81**: confirm the win shape (final-pair hold vs full-chain
  sweep) before build.
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

## Open sub-rulings queued for you

- **Q77** co-op join screen: one-button + PvP link (rec) vs two flags
- **Q78** POW creators: a+b recommended; c/d optional; e rejected
- **Q79** UAV price (rec 25) + PvP default (rec OFF until battery)
- **Q80** night wars: flag + vote entry (rec) vs seed-scheduled
- **Q81** Frontline Push win shape: final-pair hold (rec) vs full sweep
