---
name: sim-campaign
description: Run and interpret the AI-only backend sim campaign — the standard balance-validation gate for every gameplay slice (5-seed sweep, system-event exposure, asymmetry diagnosis)
---

# Backend sim campaign

The "simulate plays in the backend" methodology (dev-prompts prompt 13,
made standard during phase 11). **Every gameplay slice ends with this
gate.** It has caught: the seat bleed-out (9B), the mutual-carry standoff
(9A), per-team role bugs, the drive-by-capture regression (11B), the map
mirror asymmetry, and the carrier fuel strand (11C).

## Standard gate (run after every gameplay slice)

```bash
bash debugging/sim_campaign_wave1.sh          # 5 seeds x 12000 ticks, outcomes
# MAP=<profile> works for the gate SINCE 2026-07-31 — before that,
# sim_standard_war.js silently ignored it and every "per-map gate"
# actually gated frontier. Sweep (sim_sweep.mjs) verdicts always
# honoured MAP and stand. Blackwood needs TICKS=18000 (long wars).
SEED=2026 node debugging/sim_wave1_systems.mjs # which systems actually fired
node debugging/sim_11e_gate.mjs               # per-seed tows/rescues/downs table
```

Healthy war, current baseline (**post-coordinate-fix, 1800 wars,
2026-07-30** — the first numbers measured on cell-centred geometry;
everything older is void):

| profile | tickets | horn | std | undecided | avg ticks | tows |
|---|---|---|---|---|---|---|
| frontier | 74-80% | 11-13% | 9-12% | <1% | ~13300 | ~21 |
| sawtooth | 96% | 3% | 1% | <1% | ~12400 | ~20 |
| blackwood | 63%* | 33%* | 3% | 0%* | ~12600 | 2-4 |

*blackwood measured AFTER B3 mercy landed, which cured a 9.3% undecided
rate and a 55% horn. Its low tow count is the map, not a fault: wrecks
in dense woodland are hard to reach.

FAIRNESS, current era (2026-07-31): the old ~57-62% Outlier lean
DISSOLVED when the pacing rules landed (B1/B3/pool-315) — the skimtrail
ladder measured 52.9% A "fair chaos" and no retune was made. Post-walls
frontier reads 55.2% A (1.2σ from the fair read — watch, not act).
SAWTOOTH is the live issue: 69% A at n=1200 live config, uniques-linked
(uniques-OFF frontier reads ~45% A — the unique pair swings ~10 pts).
Blackwood PROMOTED (fair + corridors); riverline fair but horn-bound.

STORY COLUMNS (prompt 88): every sweep row now also records leadChanges,
majorityFlips, winnerMaxDeficit, winnerMargin, stdAttempts/stdScored,
fieldRepairs, bridge events, mercyBleeds (heuristic), overtimeTicks —
summarise with `python3 debugging/analyze_story.py <csv...>`. Judge any
pacing change on THESE ("did the extra minutes create stories?"), not on
average length. `TICKETPOOL=350` overrides the pool per run.
DEFAULT POOL IS 315 since 2026-07-31 (ladder verdict: 21.2 min median,
9% horn, comebacks 32%; 300/330/350/375 all read worse — story metrics
were FLAT across the ladder, the pool buys duration + horn risk only).

Sweep flags (`tools/sim_sweep.mjs`): `MIRROR=1` world reflection,
`FACTIONSWAP=1` uniques trade sides, `MAP=<profile>` (frontier_corridor
/ riverline / blackwood / sawtooth), `UNIQUES=0` disables the
(default-ON) 16B unique-crewing for A/B runs. Analyzer semantics
(`debugging/analyze_sweep.py`): TEAM bias = the same team keeps its edge
in BOTH mirror worlds; a ~50% per-seed flip rate with balanced
aggregates is fair chaos, NOT residue.

NEW-MAP GATE (specs/10 promotion gate): a fresh profile runs 30 normal
+ 30 MIRROR locally at landing, then a 300-war PC battery
(`{"kind":"map","map":"<name>","count":300}` via batch mail) before it
leaves EXPERIMENTAL. Expect per-map baselines to DIFFER from frontier's
(blackwood: quiet positional wars, downs ~12/war) — judge tempo against
the map's own identity, fairness against the universal bars (A-rate
45-55, undecided <5%). ALWAYS add a `UNIQUES=0` + `FACTIONSWAP=1` probe
pair on a new map, because unique strength IS terrain-dependent.

**But do not convict on 30 wars.** Sawtooth is the cautionary tale: at
n=30 the lean looked TEAM-linked and was written up as a Sentinel
anchor advantage; the 600-war battery overturned it completely — the
EAST side wins in both mirror worlds (A 45.6% normal, 63.0% mirrored),
which is the geometry class, not faction. Both new maps carry side
leans, in OPPOSITE directions (blackwood favours west ~59/41, sawtooth
east), which argues against one global engine chirality and for
per-map table geometry. A 30-war sample can tell you a map is worth
investigating; only a battery can tell you WHAT is wrong.

## Red flags and what they meant before

| Symptom | Past root cause |
|---|---|
| Same team wins every seed | map not mirror-symmetric (spawns/relays/patrols) |
| 0-0 frozen wars | everyone contesting one flag, out of supply = nobody can shoot or flip |
| Uniform identical scores across seeds | war becomes static — a doctrine stopped engaging |
| Winner holds the enemy standard but never scores | carrier stranded (fuel per-tick × slow chassis) |
| Seats drop to 24/32 active | a downed-seat path with no redeploy doctrine |

## Diagnosing

Write one-off probes to `debugging/` (never inline heredocs — user rule):
`dbg_asym.mjs` traces early-war disables with positions + supply state;
`dbg_carrier20.mjs` inspects a stalled unit. Pattern: run `GameServer`
headless, filter `state.events`, print positions/fuel/supply of suspects.

## Rules

- AI-only sims validate GAMEPLAY RULES (e.g. carrier-exclusive carrying),
  AI doctrine changes, and balance — before any human playtest.
- Sim-gated rulings (like Q5 AI rescue) land ONLY if the gate shows the
  feature firing without wrecking tempo or winner mix.
- Deterministic: same seed = same war. A fix must be re-verified across
  ALL 5 seeds (2026, 777, 31337, 4242, 9001), not the one that showed it.
- For big sweeps (100+ seeds, difficulty matrices, mirrored-team bias
  studies) use `node tools/sim_sweep.mjs <count>` — batch it on a
  separate machine, not in an interactive session.

CREWING ERA (2026-07-31): GameServer coerced uniqueCrewing with
`=== true`, so the SERVED game, every 5-seed gate, and every
debugging probe ran uniques-UNCREWED since 16B — only sim_sweep
(explicit UNIQUES) measured the intended game. Fixed to default-ON.
Consequences: gate outcomes before the fix are a different game;
battery/sweep numbers always were crewing-ON and stand. Any probe
that constructs GameServer directly now gets crewing ON by default —
pass uniqueCrewing: false only for deliberate A/B. SAWTOOTH: 69% A
at n=1200 live config (uniques-linked; identical pre/post walls) —
HELD, mechanism hunt before any stat change.

PEOPLE ERA (2026-08-01, fixture v55): the gate now runs walls +
pathfinding + raider's clause + stations + POW captures. Expect: 3-5
of 5 decided at TICKS=16000 (two wars just outrun the horizon — the
30-war sweep at 18000 decides them; median ~21.6 min, 0% undecided),
organic POW captures (captives fluctuate 0-2 without pre-placement),
and ERA HORN DRIFT to ~15-20% (accumulated across walls/clause/
captures — RE-BASELINE with a PC battery round before tuning anything
against the pool-ladder-era numbers). powPreplaced defaults 0 (ruled)
— POWS=2 only for human sessions until the AI raid party works.
