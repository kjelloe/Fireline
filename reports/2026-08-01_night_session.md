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
