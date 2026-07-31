# Night session report — 2026-08-01 (prompts 111-115, ~7 h autonomous)

*Branch `dev_night`, suite **714/714**, fixture **v59**, all slices
pushed. Companion: dev-log entries for every slice; plans current
(plan-version2 md+html, Q-queue refreshed).*

## Slices landed this session

| Slice | What | Gate |
|---|---|---|
| `slice-formation` | Group-movement primitive: raid party assembles near own lines, advances together, escorts lead, fights-on-the-move; freed POWs crawl home; many-hands raid clock | raids complete BOTH teams, seats re-seat |
| `slice-convoy` | Mode framework (rules-driven, hash-inert when off) + Convoy Escort v1: restart law, wrecker, whole-army posture, edge gate, radio pings | mode plays end-to-end; n=300: attacker 27%/19% |
| `slice-vote` | **Q49 ruled**: map+mode pair voting — end-screen plurality, transport-level (nothing hashed), status-quo-first candidates | ws tests + acceptance |
| `slice-caltrops` | **Q50 ruled**: light-unit chase-shapers — slow-only 30%/45 s, rack 2, M-key dispatch, truck rake, pursued-runner AI | 704/704 + gates |
| `slice-alarm-guards` | Watchman at the wire: NOT an entity (indestructible by construction), toTeam alarm ping + 30 s cooldown, defender response doctrine | raids still complete 4/5 WITH guards |
| `slice-sandbags` | **Q50 ruled**: truck-built cover — 5 s channel to impassable ground (bridges precedent), placement law incl. YOUR two-lane cap (run ≤ 4, roads never buildable), any-gun teardown | 714/714 + all gates |
| fixes | mirror-transform prison gap (all prior mirror POW reads VOID); shared raid lane; worker UNIQUES default 0→1 | see below |

## The big finding: the phantom regression

A n=300 "default-war regression" (40-44% A) was chased across two
battery rounds and turned out to be **config drift**: the plain
`sweep`/`mirror` batch jobs ran the worker's legacy `UNIQUES=0`
default — measuring uniques-uncrewed wars — while every other battery
kind and all local baselines pin `UNIQUES=1`. The A/B ladder exposed
it (`ab_baseline` on HEAD: **150/149, dead fair**). Worker default
fixed. The crewing-bug lesson now formally applies one layer up:
**when a sweep and a battery disagree, check the JOB KIND's env
before touching doctrine.**

Along the way two real bugs died: the mirror transform had never
mirrored prisons (mirror worlds ran with compounds inside the wrong
bases — all mirror POW reads before `2fd5444` are void), and the
team-keyed raid lanes (+10/+6) were replaced with one shared lane
(fair by construction; the old head-on annihilation no longer
reproduces under fights-on-the-move).

## The numbers that stand (all on honest config, n=300 per row)

| Measurement | Result |
|---|---|
| Default game, normal world | **50.2% A** — fair |
| Default game, mirrored | **48.3% A** — fair |
| A/B: no raid party | 152/146 — party doctrine is fairness-neutral |
| A/B: POW arc off | 140/160 — the arc carries no fairness debt |
| Convoy Escort attacker rate | 27% (A attacking) / 19% (B) — Q47 with the designer |
| POWS=2 pair (Q46) | collected after this report — see addendum |

## Answers you asked for

**Q24 in practice:** nothing to do. Pool 315 has been the shipped
default since the ladder verdict (2026-07-31); "ratify" only meant
"bless it so it stops appearing open." Your continued play on it is
the ratification — I've closed it in the plan.

**Your rulings applied:** Q47 convoy = evaluate after play (battery
numbers above are the baseline to beat). Q48 = convoy runs where maps
support it — the vote offers it on promoted maps; caldera joins when
fixed. Q49 voting = BUILT. Q50 caltrops = BUILT; sandbags = BUILT
with your two-lane cap (interpreted as: max contiguous run of 4 cells
AND roads/trails never buildable — stricter than the letter, provably
map-safe; loosen if you want walls ON roads). Q51 Landship queued
after vault. Q52 heist = queued after convoy tuning.

## Open questions (new + carried)

| # | Question | Owner |
|---|---|---|
| Q46 | powPreplaced flip — see addendum below | data → user |
| Q47 | Asymmetric balance bar for convoy (27/19% attacker today) | designer |
| Q53 | Sandbag interpretation check: roads never buildable (current law) vs walls allowed ON roads up to the two-lane cap? | user |
| Q54 | Vote candidates: 3 today (status quo / other map / mode flip). Want sawtooth in the pool once its playtest passes? | user |

## Next queue (per rulings)

Vault (side objective, placement rules recorded) → figure-kit art
pass (guards/POWs/downed poses) → Landship → heist mode → riverline
pacing → caldera fix. Convoy tuning waits on your playtest + Q47.

---

## Addendum: the Q46 verdict (POWS pair collected)

**Q46 answer: NOT flipped — the ruled condition fails on fairness.**
POWS=2 at n=600 with HONEST mirrors: **27.3% A normal / 22.7% A
mirrored** — team B keeps a massive edge in both worlds. Tempo passed
(undecided 1-4%, raids firing 342/287 per 300), so the formation
primitive did its job; the bias is elsewhere. Since the DEFAULT game
is simultaneously fair (50.2/48.3), the mechanism lives specifically
in the pre-placed-captive census: with 4 seats locked each team runs
~6 regents, and the prime suspect is SEAT ECONOMICS under scarcity —
the sawtooth conviction's mechanism, now on frontier, and B is the
Skimmer side. The discriminator battery (POWS=2 + UNIQUES=0, both
worlds) is queued; if it reads fair, the unique pair under a 12-crew
census is convicted and the fix conversation is the same one sawtooth
opened (premium, conditional variants, or seat-priority rules).
`powPreplaced` stays 0; POWS=2 remains the human-session experience
(where humans, not regents, hold the extra seats — the bias may not
even apply to the designed use).

**Discriminator result (first half, n=300):** POWS=2 with UNIQUES=0
reads **24.7% A — the unique pair is EXONERATED.** The census probe
shows both teams crew identical rosters under POWS=2
(tank/tank/scout/artillery/carrier/truck). Exoneration chain so far:
geometry ✗ (survives honest mirror), unique pair ✗, census ✗. The
bias is DYNAMIC — doctrine or pass-order, POWS-specific. Suspects
for the next session's hunt: prison array-order effects (team 1's
raid designation is computed first every pass), designation loops
iterating ascending op-id (team A first) in ways tick-parity does
not cover, and rescue/redeploy interactions with locked seats. The
mirror half confirms at n=600: **22.0% A mirrored** (aggregate 23.3%
A, uniques OFF, both worlds) — the exoneration is complete and
consistent. Until the
mechanism is found: powPreplaced stays 0 (unchanged default), and
POWS=2 remains the human-session experience — note the bias was
measured on ALL-REGENT wars; four humans holding those seats is a
different game.

---

## Round 2 addendum (prompt 117): figures, the vault story, verification

- **Figure kit round 1 LANDED** (`slice-figures`): every compound now
  has its watchman (alarm lamp pulses red for 5 s after his shout)
  and kneeling POW figures per held prisoner; freed POWs walk in a
  pale coat. Pose is identity; the guard has no weapon geometry to
  misread — the visual law is structural.
- **The vault lived for one battery.** Its verification read 36%/29%
  A — a ~15-pt team edge in both honest worlds from a perfectly
  mirror-paired site duo. The ab ladder convicted in one round
  (no-vault: 51.3% fair; no-alarm-response: unchanged — exonerated).
  Placement PULLED per the rearguard precedent; the machinery
  (kind, income, cap, mode exclusion, labels, tests) stays for a map
  that measures fair. Post-pull verification: **51.2%/49.2% A —
  frontier is fair again, n=600.** Lesson reinforced twice in one
  day: 5 seeds cannot see a 15-point lean, and "mirror-symmetric on
  paper" is a hypothesis until a battery agrees.
- **Q55 (designer):** WHY do north-trail objectives excite a
  team-linked mode? Same open family as the POWS=2 bias — two
  mechanism hunts, likely one latent chirality. Tools are ready
  (ab job kind, kill-switches).
- Landship is next but touches the TEAM MODEL itself (neutral hull,
  cross-team selection, either-team towing) — it opens the next
  session with fresh context rather than closing this one.

---

## Round 3 addendum (prompt 118): THE LANDSHIP

**Q42 is built** (`slice-landship`, `fd2d1d4`) — the People-arc's big
hull and the first change to the team model itself:

- One neutral fortress (chassis 10, asset 33, team -1) berths on the
  centre column each war (seed-parity picks the first berth; berths
  are terrain-aware — sawtooth's mesas taught that immediately).
- **The select is the capture**: either team claims it by climbing
  in; crewed it's protected, abandoned it can be stolen. The driver
  alone moves it; the heavy MG station outguns the driver seat by
  design — crewing up is the incentive.
- Destruction starts a 100 s clock: the wreck is EVERYONE'S tow prize
  until the clock fires, then it clears (mid-tow included) and a
  fresh neutral hull appears at the other berth. Repair it in time
  and your team keeps it. The MPG never touches it.
- Guards so nobody embarrasses themselves: AI fire doctrine ignores
  the empty neutral hull, and a human click on it CLAIMS instead of
  shells.
- AI never crews it (v1, the stations precedent — human tool first),
  so AI wars are balance-inert by construction — and the battery
  agrees: **53.4%/48.6% A, flips with the mirror, fair at n=600.**
- Seven census contract tests caught the 33rd asset exactly as they
  were built to; codex/strings/model/icon all shipped.

Try it: walk anything up to mid-map and click the big hull. J boards
the station. Suite 723/723, fixture v62.
