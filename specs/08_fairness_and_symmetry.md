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
   ties (fixed: same ladder), turnToward 180° tie (FIXED 2026-07-30:
   keyed to the unit's side of the map), and the coordinate convention
   itself (FIXED: cell CENTRES, so positions reflect exactly).

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

## 3.5 Asymmetric-faction era: which world is the fairness verdict?

Since uniques crew by default (prompt-54), TEAM = FACTION. The mirror
world now conflates side and faction effects — it can show large
"team bias" that no player ever experiences (players are side-bound to
the NORMAL world). Verdict rules of thumb:
- PLAYER-FACING fairness: the normal world's decided split + the
  faction-swap gate (the 12D authority).
- ENGINE equivariance: the mirror world and the divergence probes —
  unchanged.
- A mirror-only side×faction interaction was filed here as a
  "methodology curiosity" (normal ~48% A vs mirrored ~66% A on frontier).
  **SOLVED 2026-07-30: the mirror world was never a mirror** — see §4.
  The curiosity was the harness, not the game.

## 3.6 Stat levers saturate; worlds diverge in meaning

Band-tuning lesson (2026-07-29): marginal stat levers (hp, terrain
speed) move a structural advantage ~0.2-0.4pt per pull — when a chassis'
edge comes from a ROLE (the anchor in the tickets meta), reaching a
target on the swap metric can cost the identity. Judge against the
NORMAL world first (players live there), and prefer structural levers
(new jobs, role exclusions) over stat grinding past saturation.

## 3.7 Faction balance is PER-MAP: terrain decides unique strength

Sawtooth lesson (18B, 2026-07-29): the same tuned unique pair that sits
at 51/49 on frontier measured **62-67% Sentinel-side on sawtooth**. The
signature: the lean SURVIVES mirroring (so it is not directional
arithmetic), FOLLOWS a faction swap (so it is not a side effect), and
VANISHES with `UNIQUES=0` (14/16 — so the map itself is fair). Cause is
purely terrain: mesa gaps are ideal Deploy-Hardpoint anchors, and a map
with no water strips the Skimmer of its half of the pair.

Consequences, now doctrine:
- A globally band-tuned pair does NOT imply per-map fairness. Every new
  profile carries its own `UNIQUES=0` + `FACTIONSWAP=1` probe pair at
  landing (added to the sim-campaign skill's new-map gate).
- The fix belongs to the MAP, not the stat sheet — retuning the pair to
  suit one profile would unbalance the others. Sawtooth's answer is
  geometry (wider/doubled gaps → less anchorable), tracked as 18C.
- Corollary for the roster: designing a map that denies one faction its
  surface (no water, no trails) is a balance decision, not set dressing.

## 3.8 Measurement doctrine (designer-endorsed, 2026-07-30)

Three rules, formalised after the mirror-harness bug:

1. **Every balance claim needs instrument confidence first.** Before
   believing a faction or map advantage, confirm the mirror works,
   spawns are assigned symmetrically, terrain is represented
   symmetrically, positions are symmetric where intended, both AIs get
   equivalent information, and seeds actually vary.
2. **Separate faction advantage from side advantage** — the mirrored
   re-run is the standard test, not an optional extra.
3. **Rebaseline after ANY geometry, collision or movement change.**
   Tile geometry, vehicle offset, pathfinding, collision, road/trail
   speed, capture radius, tow reach, projectile line-of-sight — these
   are not implementation details in a spatial tactics game, they are
   GAME DESIGN CHANGES, and they invalidate old balance data.

## 4. Known accepted residues

- **The mirror harness was asymmetric, and so was the coordinate
  convention (found and FIXED 2026-07-30).** Two compounding faults:
  the reflection `(W-1)*256 - x` was anchor-preserving about cell centres
  (one cell too far west for any mid-cell position, and it sent the east
  edge to -255, off the map); and entities sat on cell LEFT EDGES, which
  do not reflect onto left edges, so no transform could ever be exact.
  **Both are fixed.** `cellToWorld(c) = c*256 + 128` (centres), reflected
  about the map's centre line (`x' = W*256 - x`), maps the centre of cell
  c onto the centre of cell W-1-c exactly. Mirror divergence moved from
  tick 2 to ticks 54-166 and the residual is now SUB-CELL (7-16 units)
  integer rounding in diagonal movement — a smaller, different problem.
- **The 180° turn tie is FIXED** (was the last listed chirality). At
  exactly 180° both turns are equally short and `diff > 128` never fired,
  so every unit turned the same way regardless of reflection. Now keyed
  to the unit's side of the map, which itself flips under reflection; a
  unit can never sit exactly on the axis (2x even, W-1 odd), so the
  tie-break has no tie of its own.
- **Consequence, and it is a big one: every balance number measured
  before 2026-07-30 was taken on the old geometry and is VOID.** That
  includes the band tuning (51.3%), B1's ending mix, and both new maps'
  verdicts. Re-measured at n=40, blackwood and sawtooth BOTH flipped from
  side-linked to TEAM-linked leans, in opposite directions — blackwood
  favouring the Outliers (a trail map, the Skimmer's affinity), sawtooth
  the Directorate (gap chokes, the Sentinel's anchors). That is §3.7
  exactly, and it means the 600-war battery that "overturned" the
  original 30-war sawtooth faction verdict was itself read through the
  broken harness: the first verdict was right.
  **Lesson for the casebook: when an instrument and a hypothesis
  disagree, suspect the instrument before rewriting the hypothesis.**
- `homeCellFor` centers floor east by half a cell for both teams.
- Riverline carries a side lean (west 73/27 post-13C; the map-aware
  ticket majority collapsed it to ~58/42) with PERFECT mirror
  statistics — an engine-fair, map-unfair profile. Open tuning
  campaign; riverline stays experimental, re-measured after 13E.
- Sawtooth carries a FACTION lean (Sentinel-side 62-67%, §3.7) and
  horn-bound pacing (87% of wars reach the horn — 3-3 relay splits
  never reach the ticket majority, riverline's first-landing pattern).
  Experimental; 18C owes both.

## 5. The one-line law

If a rule reads left-to-right, ask what it does right-to-left; if you
cannot make it commute, alternate it, flag it, or document it here.
