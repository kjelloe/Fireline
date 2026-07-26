# Rulings Round 2 — implementation report (2026-07-26, branch `dev_night`)

*Prompt 16 rulings (Q1–Q16) recorded in dev-prompts.md; forward plan in
`plan-implementation-order.md` → "Phase 11 — the Living World round".*

> **⚠ Restart your server to pick up these changes** — the MAP changed
> (four relays now, mirrored spawns) and artillery turns slower. A running
> playtest server keeps the old world until restarted.

## Landed so far

| Slice | What |
|---|---|
| `slice-11a` | Q4: artillery turnRate 5 → 2 (~6.4 s half turn). |
| `slice-11b` | Q3: BF2 capture countdown — lone team drains a relay to neutral (~3 s) then captures (~3 s), both constants configurable; CONTESTED ground freezes the clock (relay churn is gone). Flip telemetry is public in views for a capture bar. |
| `slice-11c` | Q1 role-based garage crewing + Q2d anti-standard-carrier fire doctrine + Q14 drone swatting — plus everything the sims dragged out (below). |

## What the backend sims found (and forced)

Implementing Q3 broke the AI's drive-by captures and exposed deeper
problems. Each fix is 5-seed verified:

1. **Capturer roles**: one designated agent per (team, nearby unowned
   relay) diverts and STANDS on the flag until it flips. (Naive
   "everyone capture" froze wars at 0-0 — both teams piled onto one flag,
   contested + out of supply = nobody can shoot or flip.)
2. **The map was never mirror-symmetric** — this was the root of the
   "team B ahead in 5/5 seeds" pattern flagged in the night report:
   B spawned 3 cells closer to the centre (117 vs mirror 120), and the
   single centre relay at x=63 is un-mirrorable on a 128-wide map (B's
   patrol waypoint sat ON it, A's mirror sat beside it). Now: mirrored
   spawns, **four relays in exact mirror pairs (32↔95, 58↔69)**, mirrored
   patrols. Every seed becomes a two-sided war.
3. **FUEL_MAX 2400 → 4000**: fuel bills per tick, so the slow, laden
   Command Carrier pays ~3200 for a standard round trip — seed 777's
   winning carrier stranded bone-dry mid-map with the flag aboard. 4000
   makes deep raids feasible until 11F brings real fuel logistics.

**Headline: with Q2d + the symmetric map + the fuel fix, all five sim
seeds now end DECISIVELY by standard capture around tick 3400–4000 —
~6-minute wars.** Before tonight, zero of five ever resolved.

## New questions (17+)

17. **FUEL_MAX 4000** — ratify or tune? (A tank now gets ~4 map crossings;
    a laden carrier ~1.25 standard round trips.)
18. **Residual bias**: team B still wins all 5 seeds, by a modest margin
    now (e.g. 80–105, 60–85). Hypothesis: cell-floor arithmetic gives
    west-movers a one-edge-per-leg advantage (entering a cell from the
    east happens 255 world-units earlier than from the west). Proposal: a
    mirrored-teams sim harness (swap team sides, same seed) to isolate
    geometry from doctrine before touching fixedmath.
19. **11F damaged sites**: can HOME BASES be shelled, or only
    relays/depots? (Sketch in plan assumes bases stay sacred.)
20. **War pace**: ~6-minute AI wars — right ballpark for humans, or should
    standard scoring be harder (e.g. require the carrier to IDLE at home
    briefly, interruptible)?

## Still queued from prompt 16

11D AI mines + AI pings + vocabulary (Q11/Q16) → 11E AI rescue play
(Q5, sim-gated) → 11F damaged sites + materiel (Q9) → 11G rescue
autopilot option (Q8) → 11H replay viewer (Q15). Q2b point-bleed stays
armed-but-deferred pending human standoff evidence.
