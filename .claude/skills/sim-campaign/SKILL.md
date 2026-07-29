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

Healthy war, current baseline (**B1 ERA** — a wreck costs its owner a
ticket, refunded on recovery; measured 600 wars on frontier, 2026-07-29):
endings **tickets ~79% / points-horn ~13% / Command Standard ~8%**,
undecided <2%, median decided war ~13,300 ticks, decided A-rate 51–53%
across mirror worlds, tows ~20/war with ~16 restored.

What CHANGED when B1 landed (the pre-B1 numbers were tickets 63 / horn
27 / standard 10, avg 14,500): the anticlimactic horn HALVED, wars got
~8% shorter, and the Command Standard slipped 10% -> 8% — small, and
worth watching rather than acting on. If you see horn back above ~20%,
suspect `ticketPerDisable` has been zeroed or the recovery loop has
broken. Gate seeds: expect reason-5 (tickets) to dominate, with
reason-3/4 as the minority; *mixed* winners; downs cycling with
redeploys; replay OK. (History: the pre-13H wording here misread a 16B
gate once — never panic on 5 seeds; confirm tempo shifts with a 300-seed
sweep before tuning anything.)

**Balance numbers taken before 2026-07-30 are VOID** — they were
measured on the old cell-left-edge geometry and through a mirror
transform that was not a true reflection. Re-measure rather than cite
them (see specs/08 §4).

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
