# Session Report — 2026-07-30 (branch `dev_night`)

Suite **610/610**, fixture **v42**. Everything below is committed and
pushed. This was the session where a fairness investigation turned into a
coordinate-system change, and every balance number we had was invalidated
and then re-measured.

## What landed

| Slice | What |
|---|---|
| 18F | The side-lean hunt found the INSTRUMENT, not the maps |
| — | **Cell-centred positions** (`cellToWorld = c*256+128`), fixture v41 |
| — | `resync` job kind after the battery started on a 7-commit-old build |
| slice-34 | Waypoints: shift-click / long-press queues legs |
| — | Field hull repair, capped at half hull (ruled) |
| — | AI field-repair doctrine (ruled) |
| slice-b3 | Mercy bleed + overtime |
| — | 1,800-war re-measurement battery on the corrected geometry |

## The three findings that matter

**1. The mirror harness was never a mirror.** The transform
`(W-1)*256 - x` mapped mid-cell positions one cell too far west and sent
the map's east edge to −255, off the map. Underneath it, the real
blocker: entities sat on cell LEFT EDGES, and a left edge cannot reflect
onto a left edge. Fixed by moving to cell CENTRES. Mirror divergence went
from tick 2 to ticks 54–166, with a sub-cell residual. The 180° turn tie
— the last listed chirality — was fixed on the way.

**Casebook lesson, now in specs/08: when an instrument and a hypothesis
disagree, suspect the instrument first.** I had a 30-war reading, a
600-war battery "overturned" it, I withdrew it publicly — and the
battery was itself read through the broken harness. The first reading
was right.

**2. All three maps now lean the same way, and it is TEAM-linked.**
1,800 wars on the corrected geometry:

| run | A-rate | tickets | horn | undecided | tows |
|---|---|---|---|---|---|
| frontier normal | 43.4% | 74% | 13% | 1% | 21.1 |
| frontier mirror | 38.3% | 80% | 11% | 0% | 20.2 |
| blackwood normal | 47.4% | 41% | 55% | 9.3% | 3.9 |
| sawtooth normal | 49.5% | 96% | 3% | 0.3% | 19.5 |
| sawtooth mirror | 46.0% | 97% | 2% | 0% | 21.2 |

B is ahead in BOTH mirror worlds on every profile, decisively on
frontier. A lean that survives mirroring is faction/doctrine, not
geometry — so the pair now favours the **Outliers**, and the old band
tuning (51.3% A) was an artifact of the old coordinates.

**3. Sawtooth is now our best-paced map** (96% tickets, 3% horn, 1
undecided in 600) and **blackwood's regression was cured by B3** rather
than needing its own rebuild — mercy took its undecided rate from 9.3%
to 0% and nearly halved the horn.

## Questions for you

1. **The faction band needs re-tuning on the new geometry, and I need a
   target.** Frontier — the DEFAULT map — sits at roughly 57–62% to the
   Outliers. Previously we tuned to ~52/48 measured in the normal world.
   Same target? And the same levers (Skimmer trail affinity, Sentinel
   hull), or do you want the structural option instead (Skimmer capture
   speed) now that stat levers are known to saturate?

2. **Wars keep getting shorter with each pacing rule.** ~14.5k ticks
   before B1, 13.4k after the coordinate fix, 12.8k with AI field repair,
   10.6k with B3 — about 17½ minutes against a 20–30 minute design
   target. Do you want the ticket pool raised to restore ~25 minutes, or
   is a shorter, denser war the better game? The pool is one number.

3. **Blackwood's identity**: you approved the difficulty. It still ends
   a third of wars on the horn (frontier: 13%) and runs 2–4 tows a war
   against ~20 elsewhere, because wrecks in dense woodland are hard to
   reach. Is that its character, or should it be pulled toward the
   others?

4. **Both experimental maps are now within a couple of points of
   frontier's fairness** — arguably fairer than the default. Do they get
   promoted out of EXPERIMENTAL once the faction band is retuned, or do
   you want a human playtest of sawtooth first (blackwood has had one)?

## Still open from earlier

- **Uncapped perf run** — `-Uncapped` is built and waiting on your vsync
  change; the current 61/60/59 fps is a vsync reading, not headroom.
- **B4 awards / B7 death recap** — not started. B4 needs per-operator
  deed counters (hashed state, a repin) and B7 needs the disable event to
  name the killer; neither is hard, but both are schema changes I did not
  want to start unannounced at the end of a long session.
