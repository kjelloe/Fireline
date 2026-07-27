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

Healthy war, current baseline (post-16a, 600-war census): **~2 of the 5
gate seeds end by standard capture around tick 3900–4200; the rest run
long and close** — at census scale ~27% of frontier wars end by standard,
the rest at the points horn, ~8% undecided, decided A-rate 48–52%.
*Mixed* winners across seeds, tows ≥ 2, downs cycling with redeploys,
replay OK. (The old "decisive endings in most seeds" wording misread a
16B gate in 07/2026 — don't panic at 3 long seeds; compare against the
census shares, and confirm tempo shifts with a 300-seed sweep before
tuning anything.)

Sweep flags (`tools/sim_sweep.mjs`): `MIRROR=1` world reflection,
`FACTIONSWAP=1` uniques trade sides, `MAP=riverline`, `UNIQUES=1`
enables the dormant 16B unique-crewing. Analyzer semantics
(`debugging/analyze_sweep.py`): TEAM bias = the same team keeps its edge
in BOTH mirror worlds; a ~50% per-seed flip rate with balanced
aggregates is fair chaos, NOT residue.

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
