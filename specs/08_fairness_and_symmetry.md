# Fireline Command — The Fairness & Symmetry Doctrine

**Status:** Engineering doctrine, distilled from the question-18 →
riverline → 13C investigation arc (2026-07-26..28). Read this before
touching movement, AI ordering, tie-breaks, or map layouts. The war is
deterministic and teams are side-bound — every hidden asymmetry becomes
a player-facing win-rate skew.

## 1. The invariants

1. **Layout mirror-closure.** Spawns, bases, relays, patrol tables, and
   route-graph node/edge tables come in x-mirror pairs (x' = 127-x).
   Tested (`test/route_graph.test.js` mirror test and friends). Never
   move one side without its mirror.
2. **No team owns the first move.** AI command emission alternates lead
   team by tick parity (16A); the physics march order alternates
   direction by tick parity (17). Any new sequential resolution over
   assets/teams must alternate or be order-independent.
3. **Tie-breaks must commute with the mirror.** Any `<` on ids or
   coordinates is a chirality suspect. Safe keys, in order:
   - mirror-invariant scalars: |2x−127|, |2y−127| (off-axis rank);
   - trip/actor-keyed side preference (mirror flips both actor and
     candidates, so "prefer my own side of the axis" commutes);
   - ids ONLY for the leftovers (and know you accepted chirality there).
   Casebook: heading-snap ties (fixed: even direction index), movement
   floor-div (fixed: truncDiv), nearest-node ties (fixed: off-axis
   rank), mirror-partner node ties (fixed: origin-side), relay-seek
   ties (fixed: same ladder), turnToward 180° tie (KNOWN, rare,
   mirror-odd; fix sketch: turn away from map center).

## 2. The instruments (all in debugging/)

| Tool | Question it answers |
|---|---|
| `dbg_mirror_diverge.mjs` | run one seed normal + world-mirrored in lockstep; the FIRST tick the mirror breaks names the asymmetric subsystem. Caveat: anchor-preserving reflection vs mid-cell floor sampling produces a benign divergence (~tick 20-90); real bugs usually fire earlier. |
| `dbg_route_equivariance.mjs` | enumerate mirrored trips through the route graph; any violation prints both routes. 4800 trips, 0 violations is the shipped bar. |
| `dbg_ablate_sweep.mjs` | subsystem ablation over N wars (nowater/nopaths/nomines/…): whichever ablation kills an edge names its mechanism. |
| A/B option flags + sweeps | when a doctrine is suspect, flag it, run with/without × normal/mirror. This convicted rearguard (~25 pts) in one run. |
| `analyze_sweep.py` | the verdict logic. READ THIS: per-seed flip rate measures CORRELATION only; TEAM bias = the same team keeps its edge in BOTH mirror worlds; a ~50% flip with ~50/50 aggregates is fair chaos, not residue. |

## 3. The campaign pattern

1. Suspect an edge → 300-war sweep normal + mirrored (local, ~10 min).
2. Aggregate ~50%? → fair. Same-team edge both worlds → TEAM bias:
   hunt ordering/doctrine chirality. Edge flips with the mirror →
   SIDE bias: hunt directional arithmetic or war-shape; ablate.
3. Fix, prove with the probe/enumeration, re-sweep, record the whole
   chain in dev-log (including wrong guesses — they prune the next
   hunt).
4. Anything failing its gate ships DORMANT behind a flag with the
   evidence chain (the 16B pattern), never half-tuned.

## 4. Known accepted residues

- Mid-cell terrain sampling is not exactly mirror-equivariant under the
  anchor-preserving reflection (±1 cell at boundaries). Proven
  direction-symmetric in-world; treat probe divergences at that scale
  as artifact.
- `homeCellFor` centers floor east by half a cell for both teams.
- Riverline carries a side lean (west ~73/27 post-13C, was east 58/42
  pre-13C) with PERFECT mirror statistics — an engine-fair, map-unfair
  profile. Open tuning campaign; riverline is flagged experimental.

## 5. The one-line law

If a rule reads left-to-right, ask what it does right-to-left; if you
cannot make it commute, alternate it, flag it, or document it here.
