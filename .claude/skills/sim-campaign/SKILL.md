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

FAIRNESS, and this is the live issue: all three profiles lean to team B
(the Outliers) in BOTH mirror worlds — decisively on frontier (~57-62%).
A lean surviving the mirror is faction/doctrine, not geometry. The band
needs re-tuning on the new coordinates; until it is, do not read a
per-map A-rate as a map verdict.

STORY COLUMNS (prompt 88): every sweep row now also records leadChanges,
majorityFlips, winnerMaxDeficit, winnerMargin, stdAttempts/stdScored,
fieldRepairs, bridge events, mercyBleeds (heuristic), overtimeTicks —
summarise with `python3 debugging/analyze_story.py <csv...>`. Judge any
pacing change on THESE ("did the extra minutes create stories?"), not on
average length. `TICKETPOOL=350` overrides the pool per run.

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
