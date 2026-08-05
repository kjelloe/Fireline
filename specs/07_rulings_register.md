# Fireline Command — Design Rulings Register

**Status:** Living document. Every gameplay-affecting design ruling made
during development, in one durable place. (The verbatim prompt log is a
local-only file by choice; this register records the *decisions*.
`dev-log.md` records how each landed.)

## The tenet every ruling is tested against (prompt 62)

> **"Can every type of player find something useful and fun to do
> within 60 seconds of spawning?"**

Elevated from the map-design checklist to the general law for ALL
design decisions — maps, chassis, missions, pacing rules. It catches
this game's characteristic failure modes earlier than any sweep does:
running-simulator travel, objectives nobody visits, support roles with
nothing to do, and mid-war slumps. To apply it, walk the roster (tank,
scout, truck, carrier, bike, mortar, artillery, faction unique, downed
operator on foot) and name each one's useful first-minute action; if an
answer is "travel toward the fight" or "wait", the design is not done.

The engine has a hard-edged version of the same law: an objective
outside `CAPTURE_SEEK_CELLS` of where units actually go is never used
at all (18C, below).

## Core fantasy & objective (prompts 16–19 era)

- **Mission cards rank by VALUE, then locality (prompt 79)**: the card
  strip sorts by the Recognition value of the deed, then by distance, so
  the most valuable work surfaces and among equals the nearest one does.
  Cards that are not themselves scored deeds take the value of what they
  PROTECT (stop_thief / secure_standard = 25, the capture they deny or
  defend). Keeping the two tables aligned is deliberate: a card ranked
  high but scored low teaches the wrong lesson.
- **Rescue outranks kills** — Recognition scoring: tow 8, rescue 10,
  standard return 10, standard capture 25, relay 10, kill 5. Awards go
  to the operator at the verified reducer fact; automatic outcomes
  (mines, drones, auto-return) award nobody.
- **Command Standard** is the primary objective; only carriers take the
  enemy standard; scoring requires your own standard secure.
- **BF2-style relay capture**: neutralize ~3 s + capture ~3 s countdown,
  presence-based; bikes neither capture nor contest; only artillery
  breaches sites (siege flag).
- **Damaged sites**: relays/depots have hp; artillery shells them;
  trucks repair via materiel.
- **MPG (Minimum Playability Guarantee)**: below N operable, the base
  slow-manufactures rebuilds. Session-tunable (13F rules, hashed).
  RULED (BF2 study): rebuilds arrive as a FULL WAVE per cadence.
  Rebuild position is base-derived (mirror-honest), type/row pinned.
- **Difficulty presets** (13G): easy 8/600 · normal 6/900 (= default,
  identity-pinned) · hard 4/1500; server-only (`RULES=` env) for now.

## Roster & factions

- 9 chassis, explicit contract flags on every one: canTow,
  canCarryStandard, capacity, canMine, canClearMines, heavy, canCapture,
  siege, deployable (Sentinel), amphibious (Skimmer).
- Per team: 4 tank / 3 scout / 2 artillery / 3 logistics / 2 carrier /
  1 bike / 1 mortar (+ faction unique in garage slot idx 10).
- **Factions** (designer ruling, specs/faction-name-and-units.md): The
  Directorate (slate/police blue, grid shield, Sentinel / Deploy
  Hardpoint) vs The Outliers (terracotta/tan, offset arrow, Skimmer /
  Riverline Drive). Identity-only in 12A; uniques replace a garage
  slot; never a 17th asset. Asymmetry gated by the faction-swap sweep.
- **Unique AI crewing (16B): LIVE, default ON** (prompt-54): Riverline
  Drive gained TRAIL AFFINITY (T_PATH 384, amphibious only) and the
  swap gate closed at 54.5% Sentinel-side. Band-tightening (prompt-56)
  EXECUTED: trail affinity 416 + Sentinel hp 120 (fixture v40) —
  NORMAL-WORLD split 51.3% (the 52/48 target where players live); the
  swap metric saturates at 53.6 (stat levers exhausted; structural
  option filed: Skimmer capture-speed affinity — designer's call).

## Fairness (the non-negotiables)

- Mirror symmetry is a TESTED balance invariant: spawns, relays,
  patrols, route-graph tables all mirror-closed. See
  specs/08_fairness_and_symmetry.md for the doctrine.
- Tick-parity command order (16A) and parity march order (17) — no
  team owns the first move, in commands or in physics.
- Acceptance bands: aggregate win rate across mirror worlds ~50%;
  chassis pairs judged by the faction-swap transform.

## Movement & physics

- Integer fixed-point (256/cell); truncDiv stepping (mirror-symmetric);
  even-index heading-snap tie-break; per-chassis terrain speeds incl.
  T_PATH (heavy penalty) and T_WATER (amphibious highway).
- **Collision (17, playtest-7 ruling)**: HARD blocking vs enemies
  (block radius 192), SOFT half-speed compression through friends
  (radius 128); only CLOSING moves constrained — separating is always
  legal; wrecks and downed crews don't collide (v1). Body-blocking is
  an intended tactic.
- **Route graph (13C)**: AI drives waypoint chains on per-profile
  road/trail/bridge graphs; equivariant tie-breaks proven by
  enumeration; amphibious hulls skip the graph.
- **Impassable terrain is a WALL (18B)**: units refuse to enter a
  0-speed cell and stall at its face (speed samples the current cell,
  so entering would trap them forever). Drones fly over; downed crews
  walk terrain-free. Engine-wide, inert on maps without T_BLOCKING.
- **Objectives must sit in reach (18C)**: a relay further than
  `CAPTURE_SEEK_CELLS` (16, Manhattan) from anywhere units actually go
  is never captured by anyone — the AI designates capturers only from
  assets already inside that radius. Such a relay silently leaves the
  ticket math and can make the majority unreachable. Map-side rule (the
  radius is NOT tuned per map — that would reopen every map's balance).
- **Bridge demolition (13E, LANDED)**: riverline spans are damageable
  ({id,hp}, hashed). ONLY artillery breaches them; a breached span turns
  to WATER (so the amphibious Skimmer is the standing answer to a
  demolition); EITHER TEAM's truck rebuilds it (prompt 70 — no ownership
  concept, and the tug-of-war is the point; if instant rebuilds prove
  too cheap the lever is repair TIME, not rights). Bridges are NOT
  sites: they own nothing, project no supply or sensors, and never count
  toward the ticket majority. AI doctrine LANDED (13E-2): tubes drop a
  span only when LOSING that crossing, one besieger per span; trucks
  rebuild it as a materiel errand.
- **Meaningful deaths (B1, LANDED + VERIFIED)**: a wreck costs its owner
  ONE ticket, refunded when the wreck is recovered; `ticketPerDisable`
  tunes it and 0 restores the old world. Both wreck paths charge so the
  ledger balances without per-asset bookkeeping. 600-war verdict: the
  anticlimactic horn HALVED (27% -> 13%), wars ~8% shorter, the Command
  Standard held at 8% (it is NOT crowded out — the question B1 shipped
  with), fairness untouched at 51-53% across mirror worlds.
- **Map roster (prompt 60)**: specs/10_map_roster.md is the map design
  of record — checklist audit, hard profile constraints (mirror,
  shared bases/road, west-gen, runway), maps 3 `blackwood` + 4
  `sawtooth`, a 6-map bank, and the per-map promotion gate
  (experimental MAP= opt-in until a 300-war PC battery passes).

## Pacing & victory (BF2-study rulings, 2026-07-28)

- **Ticket bleed (13H): HYBRID** — relay majority bleeds enemy tickets
  (pool ~300, majority threshold, ~1/2 s — sim-tuned); empty pool =
  loss; the points-horn stays as backstop.
- **Field respawn (15F): crewed carriers only**, per-operator cooldown.
- **Lateral relays**: frontier gains two mirrored pairs on the trail
  loops — (44,40)/(83,40) and (44,86)/(83,86) — an 8-relay conquest web.
- **AT satchel (LANDED, 16f)**: one per bail-out (hashed), adjacent,
  60 damage, single-use, loud (event + auto team ping), kill credit to
  the operator; click an adjacent enemy while downed to plant.
- Forced respawn at base after a 10 s countdown (playtest 7 item 15);
  the abandoned hull stays in place and SELF-RECALLS — 60 s uncrewed in
  the field auto-wrecks it (towable/rebuildable). Carrier field-respawn
  cooldown: 30 s per operator.

- **12F POW release (prompt-56): RAIDABLE HOLDING SITE** — POWs held at
  the captor's base depot; a friendly hull reaching it frees them
  instantly; rescue raids become a mission card.
- **14F audio (prompt-56): SYNTH FIRST** — WebAudio patch manifest per
  chassis×event; samples may drop into the same manifest later.

- **Weather fronts (16G, LANDED — gameplay-evolved #4b)**: once per
  war, seed-scheduled (pure function, mid-war band, 90 s), every sensor
  halves for both teams; edges announce themselves. No hashed state.
- **Gameplay-evolved triage** (prompts 57/57-ext): build candidates
  ruled/queued — weather ✅, bridges, salvage, Last Convoy, meaningful
  deaths (B1), mercy/overtime (B3), node classes (B2), awards+recap
  (B4/B7), comm wheel (B5), neutral drop (B6); ~30 idea-bank entries in
  reports/2026-07-29_gameplay_extensive_eval.md.

## AI doctrine rulings

- AI regents crew every empty seat; role ladder and errands in
  specs/09_ai_regency_doctrine.md.
- **Escort doctrine (item 11, ruled): BOTH triggers** — the carrier
  raids with ≥2 combat escorts moving alongside (~6 cells), OR through
  a sneak window (enemy strength near the route under threshold);
  aborts if escorts die mid-run.
- AI pings sparingly (one per seat per 30 s); regents mine near owned
  relays, clear marked mines, shoot pestering drones.

- **Underdog premium — faction AND map (prompts 58 + 68, FUTURE
  profiles/ranking)**: global ranking points and honors scale UP for
  whichever side carries the measured disadvantage — harder challenge,
  more reward. Two axes, same mechanism:
  - FACTION: the faction with the lower measured win rate (currently
    the Outliers).
  - MAP/SIDE (prompt 68): on a profile that measures a persistent lean,
    the disadvantaged team earns the premium ON THAT MAP.
  Both derived from live sweep data, never hardcoded, so they
  self-correct as balance shifts — and so a premium can never be farmed
  by picking the "weak" side once it stops being weak.
  CONSEQUENCE FOR THE MAP GATE: a measured lean no longer automatically
  disqualifies a profile. A map may ship EXPERIMENTAL-with-premium while
  tuning continues, provided the lean is (a) measured at sweep scale,
  (b) disclosed in specs/10, and (c) not so large that the disadvantaged
  side stops being fun to play — the premium pays for a hard fight, not
  for a hopeless one.

## Presentation & platforms

- Painted low-poly hybrid; diorama read. Title/copy rules in
  specs/title-and-naming.md (Fireline Command).
- Baked sprite sheets + 2D canvas fallback (WebGL-absent), minimap
  icons seeded from them; fps-floor auto-engage awaits GPU perf data.
- Mobile touch = skin over drive intents; i18n total (en/no).
- Global discovery: adopt the sibling master-server pattern
  (specs/game-discovery.md) — announce/probe/list, probe-before-list,
  checksums in the announce; reconnect banner precedes it (landed).
  Master index COLOCATES on the game VM; its own server is listing #1.

## Session & infrastructure

- **Map rotation & voting (prompt 63, FUTURE — with the map roster and
  the server-community wave)**: a server option chooses between RANDOM
  rotation and END-OF-ROUND MAP VOTE. Voting shows each candidate as a
  MINIMAP THUMBNAIL (the profile generator is pure, so a thumbnail is
  cheap and honest — same cells the war will use); random rotation
  shows the NEXT MAP on the end screen instead of a vote. Server-only
  authority as with every session rule, so replays stay honest. Depends
  on: the roster having enough promoted profiles to be worth choosing
  between (specs/10), plus a thumbnail renderer.
- Session rules hashed in state (13F); replays re-simulate the same law.
- Every gameplay slice ends with the backend sim gate; balance claims
  need sweep-scale data (local 300+, PC 600+).
- Batch PC runs sweeps via agent-mail; results return as CSV mail;
  worker self-updates via the `update` job.

## Designer rulings, 2026-07-30 (the four decisions)

- **Faction band: target 52/48, tolerate 54/46, 57-62% is too high.**
  Explicit reasoning to keep: in a team objective game a 60% faction
  becomes the CORRECT faction, not the different one. The 54/46
  tolerance is CONDITIONAL on the stronger faction varying by map —
  ours currently leads on all three — the user has RULED the drift to
  54/46 acceptable anyway (prompt 88): tune toward 52/48, stop pulling
  levers once inside 54/46.
- **Lever: conservative Skimmer MOBILITY first (trail speed), NOT the
  capture-speed redesign.** Capture speed is a faction-identity change,
  not a balance knob: it would make the Outliers better at both halves
  of objective play (reaching the point AND taking it), which compounds
  rather than adds. Banked structural variants for later, all
  CONDITIONAL rather than raw: Skimmer neutralises faster but does not
  complete captures; captures faster only when uncontested; grants
  capture speed to nearby infantry; or gains capture speed and loses
  durability. Restore the baseline first.
- **War length: target 20-22 minutes**, not 17-18 and not back to 25.
  Raise the ticket pool modestly (test 330 / 350 / 375). Judge it on
  MEDIAN and quartiles, horn rate, comeback rate, lead changes,
  recoveries and standard attempts — "did the extra minutes create
  stories, or just delay the result?"
- **Blackwood: identity VALID, suppressed recovery is a FAULT.** Fewer
  rescues than other maps is correct; near-zero is not. Fix by selective
  recovery corridors (narrow tow trails, logging roads, clearings at
  wreck zones, risk/reward routes) — "do not turn Blackwood into
  Frontier with trees". Diagnose WHY wars time out before opening
  terrain. Prompt-88 scope: TERRAIN ONLY first; the map-specific
  recovery infrastructure ideas (forest winch station, tow depot,
  capturable ranger station) are BANKED for later, not built.
- **Rotation: promote blackwood after the retune; HOLD sawtooth for a
  human playtest** despite excellent AI metrics, because narrow-gap maps
  need human frustration testing specifically (constrained? predictable?
  camp-prone? punishing for picking the wrong lane?).

## Open design questions from playtest 9

- **FIELD HULL REPAIR — RESOLVED (ruled prompt 85, built same day):**
  capped truck repair to HALF hull, AI doctrine followed (prompt 86).
  Original question kept for the reasoning:** The ask was "request repairs when HP is under a certain
  level". Investigating it turned up something we had never noticed:
  **nothing in this game repairs a damaged LIVING hull.** Base resupply
  restores ammo and fuel only; trucks repair SITES; a wreck is only fixed
  after being towed to the bay. So a "needs repair" mission card would be
  an instruction with no possible action — a direct violation of the
  60-second tenet — and I did not build it.

  The natural implementation is a truck with materiel restoring hp to an
  adjacent damaged friendly, mirroring the site-repair loop exactly. It
  is small. What makes it a RULING and not a chore is the balance risk:
  hulls become materially more durable, which cuts against the recovery
  economy B1 has just made central (fewer wrecks = fewer tows = fewer
  tickets saved). It could also make the front sticky, since a damaged
  push no longer has to withdraw.

  Options: (a) build it and sweep it, accepting that B1's numbers will
  need re-measuring; (b) build it capped (repair only up to ~50% hull, so
  a mauled hull still wants the bay); (c) leave hulls unrepairable and
  keep "withdraw or die" as the identity. My lean is (b) — it answers the
  player's request without deleting the tow economy.

  The fuel/ammo half of item 32 IS built (a `resupply` card, value 4,
  below every rescue and tow) because `transfer_cargo` already makes it
  actionable.

## Open design questions from playtest 8

- **Should seat swapping require a base/site? (item 22, UNRULED)** The
  player expected "Next asset" to work only inside a base area. The
  ENGINE has no such restriction today — `select_asset` is legal
  anywhere, and the AI crewing ladder (a freed seat picks the best
  available hull, wherever it stands) depends on that. Adding the
  restriction is a gameplay change with sim consequences, not a UI
  tweak, so the client currently greys the button only for conditions
  that genuinely block a selection (downed, respawning, aboard, nothing
  free). If the rule IS wanted: it needs a reducer gate, an AI doctrine
  answer for field re-crewing, and a sweep to confirm tempo survives.

## Q31 ruling (2026-07-31): the sawtooth rectification

User ruled BOTH levers after the factionswap conviction (the unique
pair decides sawtooth; mechanism = seat economics):

1. **The RAIDER'S CLAUSE** — the banked conditional capture variant,
   now live: the Skimmer (contract flag `raider`) captures at DOUBLE
   speed only when no operable enemy is within `RAID_RADIUS_CELLS`
   (8) of the flag. Mobility becomes earnings on every map; the bonus
   dies the moment a fight starts, so it cannot compound (the
   original objection to raw capture speed).
2. **AI SEAT-SWAP DOCTRINE** — a regent crewing a unique whose seat
   earned NO recognition across `EARN_WINDOW_TICKS` (1500) abandons
   it for a free real hull; the unique is benched for the rest of the
   war. Humans untouched. ("The punishment for a bad unique is
   surviving in it" — ended.)

Gate: sawtooth 30+30 mirrored after both levers, then the PC battery.
The premium stays live until a battery shows the band restored.

## Prompt 145 rulings (2026-08-02)

- **Q71 GO**: tick-parity command order trialled behind ORDERPARITY=1
  (odd ticks: team B's AI commands first, stable within team).
  Batteries queued; default flips only on verdict.
- **Q63 BLESSED**: caldera's death-circle IS the map — 13-minute
  elimination brawls are its identity, not a defect. Fairness (54.3/
  51.7) already passed; identity now ruled.
- **Q64/Q65/Q66**: the weapons cache ships on SAWTOOTH first; the
  aura radiates while owned (suppression-independent); plain
  capture-seek v1, measure before weighting. (Sequenced AFTER the
  Q71 verdict — a default flip would re-baseline the trial battery.)
- **Q69 ACCEPTED**: riverline's unique-pair lean stands; team B earns
  the 25% underdog premium (gen_premium conviction, 56.9% agg) with
  automatic briefing disclosure — the sawtooth pattern.
- **Q70 (reframed as a question)**: "is a faster getaway car
  SUFFICIENT?" — to be answered with data: fast-raider mode rule
  behind a switch, heist pair battery. After Q71.
- **Q53**: road walls ALLOWED up to the cap — implemented as the
  TWO-LANE LAW (a road build must leave >=2 open road cells in its
  column cross-section; the run cap alone couldn't guarantee it).
  Balance condition: gate green; AI builds no road walls, so the
  live risk is human-session feel — watch the playtest.
- **Q56**: landship stays human-only for now (re-affirmed).

## Prompt 154 ruling (2026-08-03) — D+C: the unique-pair policy

Measured, DISCLOSED ticket offsets for OUTCOME fairness (the
disadvantaged team starts +N tickets on battery-convicted maps;
ladder-tuned; briefing disclosure both directions) + the underdog
premium stays for REWARD fairness. A stays only as targeted mechanism
fixes; B's unique-bench only as a temporary measure if a lean is
intolerable pre-tuning. Mode-role counterweights ride mode rules
(the defender-MPG precedent).

## Prompts 174-175 rulings (2026-08-04/05) — WAVE 4, the FUN wave

The design-review slate (prompt 173 review; full plan in
`plan-wave4.md`). All five sub-rulings resolved in prompt 175.

- **Q77 — team stacking**: NO join-screen change. The 2-human balance
  gate becomes a SETTING, **default OFF** — friends stack a team
  freely and the Regency holds the other side. `TEAMBALANCE=1` /
  `--teambalance` restores the competitive gate; `s_lobby` carries
  `balance` so the client greys buttons only when it is enforced.
  SHIPPED (W4-1).
- **Q78 — what else creates POWs**: **a, b, c and d all land**; e is
  rejected.
  a. failed heist — the Asset carrier disabled inside the defender's
     half is CAPTURED, not downed (the vault's guards take them);
  b. deep-down capture law — a downed operator whose timer expires
     inside the enemy COMPOUND becomes captive (the universal one,
     and the reason standard wars will finally grow POWs);
  c. failed prison raid — raiders downed inside the raid radius while
     the alarm is live are captured;
  d. convoy driver — the truck's driver is captured if the wreck sits
     undefended 60 s (keep the window generous so the RESTART law
     still matters);
  e. boxed-in surrender — REJECTED, it fights the fights-on grain.
  All four reuse `OP_CAPTIVE` + prisons as built; no new hashed
  fields, but the event stream changes so each transition needs a
  reducer pin. PLANNED (W4-8).
- **Q79 — the recognition sink**: UAV sweep costs **25** recognition
  for a 10 s radius-8 reveal. ON when team balance is off (the co-op
  posture), OFF in balanced/PvP wars until a battery says otherwise.
  Honesty rule: honors keep judging recognition EARNED; spending
  draws from a separate available pool. PLANNED (W4-7).
- **Q80 — night wars**: an always-available `--night` flag PLUS a
  vote-pool entry. No seed scheduling. PLANNED (W4-10).
- **Q81 — Frontline Push win shape**: **final-pair hold** — hold the
  enemy's last relay pair for 60 s; tickets on the stall clock
  otherwise. Not a full-chain sweep. PLANNED (W4-11).

## Measurement-driven rulings (2026-08-05, prompt 176-177)

These were decided BY DATA under the era's own laws, not by taste —
recorded here because they reverse or retire earlier rulings.

- **Q75 — sawtooth's hold: ANSWERED BY MEASUREMENT.** The map reads
  **54.8/54.4 on a81477c** (was 69.3/67.1). The lean was the two
  phase-lock bugs, which sawtooth's tight chokes amplified hardest by
  producing the most head-on meetings per war. The HOLD LIFTS. Every
  pre-a81477c sawtooth number is last-era, including the Q73
  "uniques-linked" attribution.
- **THE PREMIUM TABLE EMPTIES (both entries pulled).** sawtooth 54.6
  aggregate (under the generator's 55 threshold) and riverline 49.0
  (fair) no longer convict. `MAP_PREMIUM` is empty by its own law: an
  entry without a live conviction is a lie the briefing repeats to
  every player. **Q69 is SPENT, not overturned** — it accepted
  disclosure of a measured lean that has since been engineered away;
  one line restores it. Outcome-neutral (recognition only, never
  teamScores), so no battery was required.
- **THE POWS ROOT: the AI raid party.** POWS=2 baseline 39.4/36.4 ->
  RAIDPARTY=0 **54.2/51.2, in band in BOTH worlds**; POWARC=0 reaches
  only 41.5%. The POW arc itself is nearly innocent. Open follow-up:
  the raid-party census (hulls committed per team, party lifetime,
  losses while live) to name what inside the party is team-keyed.
- **Q82 (NEW, for the designer)**: convoy attackers now win
  **16.3% (A) / 14.3% (B)** — the 25-point TEAM gap collapsed to 2
  points of noise, so the mode is symmetric but defender-dominant.
  That is a DIAL, not a bias. Is ~15% the intended bar for an
  asymmetric escort mission?
- **Q74 (open)**: frontier 54.0/52.9, sawtooth 54.8/54.4, blackwood
  52.8/51.1 — the whole slate now sits in the band's UPPER half.
  Accept a ~3-point house lean as tolerance, or hunt once more after
  the raid-party census?


## Prompt 181 rulings (2026-08-05)

- **Q83 — the raid party: GATE IT.** A party may not form unless a
  carrier is committed and within reach (40 cells of the staging cell).
  Basis: the census showed the doctrine landing ~1 raid per war and
  completing ZERO across ten war-sides, while pinning a hull plus two
  escorts for most of the war — springing POWs is only step one, and
  the carry-home leg had no transport. Implemented in ai_regency
  (`RAID_CARRIER_REACH_CELLS`), pinned by three tests, committed
  hull-time roughly halved. Same-build POWS=2 pair queued for the
  balance claim.
- **Q74 — the house lean: TOLERANCE.** frontier 54.0/52.9, sawtooth
  54.8/54.4, blackwood 52.8/51.1 all sit in the band's upper half;
  caldera leans the other way. Accepted as in-band. CLOSED.
- **Standing directive (not a Q)**: add source lints liberally, and
  BEFORE behavioural gates. Silent failures — a command missing its
  validate case, a client gate on an unprojected field — pass client
  smoke and UI acceptance unnoticed. See `test/lints.test.js` and
  `test/view_contract.test.js`.


## Prompt 182 outcomes (2026-08-05)

- **Q82 — the convoy attacker bar: RULED (2) then (1), target 30-40%.**
  CORRECTION FOR THE RECORD: there is no defender MPG *bonus* — the
  convoy defender's factory already ran at HALF rate (a counterweight
  favouring the attacker), so option (2) means turning that lever UP.
  Rung 1 (`rules.convoyDefenderPenalty` 2 -> 3, i.e. a third rate) is
  MEASURED: attackers 16.3/14.3% -> **18.7/19.7%** — now symmetric to
  within noise, but well short of the ruled band. Ladder queued at 4
  and 5; if the curve flattens, rung 2 is shortening the route/clock
  rather than an ever-harsher factory penalty.
- **The premium pull: CONFIRMED** ("ok if leans are not there"). Both
  sawtooth and riverline entries stay out; the mechanism stays live and
  tested for the next map that earns one.
- **Q78/W4-8 POW creators: MEASURE AND TUNE** — implement a+b+c+d, then
  measure, rather than pre-tuning on intuition.


## Prompt 185 rulings (2026-08-05)

- **Q82 CLOSED**: scale 80 ADOPTED as the convoy default
  (`CONVOY_ROUTE_SCALE`). `convoyRouteScale: 100` restores the classic
  run. Defender penalty stays at 3.
- **Q84 RULED**: the deep-down capture law stays HUMAN-ONLY DRAMA —
  accepted as a rare event AI wars cannot produce. Noted at the code
  site; any future change is to be recorded there. The alternative on
  record (retrigger on down-time-inside-the-compound) is a design
  change, not a tuning nudge.

## Prompt 184 outcomes (2026-08-05) — both open dials CLOSED on data

- **Q82 SOLVED at rung 2.** `convoyRouteScale` 80 (20% shorter run)
  reads **38.3% attacker** — inside the ruled 30-40% band, from 18.7%
  at rung 1. The factory ladder bought 8 points across four steps and
  was flattening; 20% off the route bought 20. The binding mechanism
  was the DISTANCE, never the defender's rebuild rate. Recommended
  default: scale 80 with the defender penalty held at 3 (it makes the
  two directions symmetric). Awaiting the owner's word to make it the
  shipped default.
- **Q83's gate CONFIRMED.** POWS=2 with the carrier gate reads
  **52.6% A** (ungated baseline 39.4%) — in band, and within noise of
  RAIDPARTY=0's 54.2%. The gate recovers the full deficit WITHOUT
  disabling the feature, which is why option (2) was the right ruling.
- **Q84 (NEW, for the owner)**: W4-8's deep-down capture law fires
  zero times in AI wars — an AI crew redeploys before the timer can
  expire inside an enemy compound. Leave it as a rare human-only
  drama, or move the trigger to down-time-inside-the-compound (which
  fires constantly and reshapes every base assault)? A PLAYTEST is the
  instrument, not a battery.
