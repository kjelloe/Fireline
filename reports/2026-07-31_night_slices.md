# Session Report — 2026-07-31 (branch `dev_night`)

Suite **629/629**, fixture **v44**. Everything committed and pushed.
The night's arc: the pool decision (measured, landed), blackwood's
recovery corridors (measured, working), the B4+B7 filler pair, three
instrument bugs found and fixed, and the Skimmer band retune LAUNCHED
on the PC (ladder in flight at time of writing).

## What landed

| Slice | What |
|---|---|
| — | `pool` job kind (TICKETPOOL passthrough; uniques pinned ON for probe comparability) |
| 18G | Blackwood LOGGING ROADS — lateral tow corridors (rows 45/82, x 36..91) + route-graph junctions 18-21 |
| B7 | Death recap: "DISABLED — artillery from the north-west" on the down banner, both locales |
| B4 | Category honors: 7 hashed deed counters/operator (fixture v43), end-screen awards |
| — | **Pool verdict: default ticketPool 300 → 315** (fixture v44) |
| — | `skimtrail` band-tuning lane + 6-battery mirrored ladder queued |
| fix | `sim_standard_war.js` ignored `MAP` — every per-map 5-seed gate ever run was gating FRONTIER |
| fix | `copyState` aliased nested arrays (deeds AND slice-34 waypoints) across ticks — replay scrub caught it |
| fix | `batch_collect` overwrote same-label CSVs — now shelves the old one as `.prev` |

## The pool decision (n=300 per rung, frontier, live config)

| pool | median | horn | tickets | comebacks |
|---|---|---|---|---|
| 300 | 19.7 min | 7% | 84% | 31% |
| **315** | **21.2 min** | **9%** | **82%** | **32%** |
| 330 | 22.2 min | 10% | 80% | 31% |
| 350 | 23.1 min | 15% | 75% | 31% |
| 375 | 24.6 min | 20% | 70% | 30% |

**315 is landed as the default** — dead centre of your 20–22 window.
Two findings you should see:

1. **The instrument killed a myth**: story metrics are FLAT across the
   whole ladder (lead changes 2.7 everywhere, comebacks ~31%). A bigger
   pool buys minutes and horn risk and *nothing else* — "longer so
   stories can happen" is not what the data says. Winners almost never
   flip with pool size; per-seed checks show the same wars, stretched.
2. **The n=20 probes under-read length by ~3 minutes** (early-seed
   skew, the same trap twice). Rule recorded: never trust a 20-seed
   median for pacing.

## Blackwood corridors (18G) — working, identity kept

Instrument first: wrecks were NOT unreachable (median 2 cells from
fast ground). The loop leaked at the DRAG HOME — 44% tow completion vs
frontier's 80%, because every route out of the combat heart crossed
the central crossfire. Two logging roads (terrain-only, as ruled) let
a loaded tow exit sideways. Measured: completion 44%→73% (probe),
restores/war ~1.7 at n=300, undecided nearly halved (28→8–16 of 300),
tows still ~2.5/war vs frontier's ~9 — *fewer rescues than other maps,
but they complete now*. Fairness: the residual lean FLIPS with the
mirror (A 46.7%/52.1%) — side-linked, small, no faction conviction.

## Questions (numbering continues from Q23)

- **Q24 — ratify pool 315?** Landed on the evidence above; easy/hard
  presets (400/250) untouched. Cheap to revisit if 21 minutes plays
  longer than it reads.
- **Q25 — mercy is now a main mechanism.** It engages in 86–91% of
  wars at EVERY pool size. It was designed as an edge-case rescue from
  spawn-camp drag. The wars it produces look right (decisive, low
  horn), but the design's centre of gravity moved — bless it, or should
  the trigger tighten (e.g. `mercyPoolFraction` 4 → 5)?
- **Q26 — award names/tone.** End screen now grants BEST RAIDER / BEST
  RECOVERY / BEST CAPTURER / HERO OF THE CONVOY / FIELD MECHANIC (top
  count, ties to lower id). Your eval also named "Best Escort" — there
  is no escort recognition counter to read, so it does not exist yet.
  Want an escort RECOG (engine change: award proximity-escort deeds),
  or drop it?
- **Q27 — blackwood promotion: RESOLVED by your standing ruling.** The
  band ladder came back before you did (see below) — inside tolerance,
  no retune needed — so blackwood was promoted per "promote blackwood
  after retune". Revert is one line if you want a final look.

## The band ladder verdict (landed after the report was first written)

**No retune needed — the lever stays at 416.** At the current value:
A 54.5% normal / 51.3% mirrored; the paired analyzer reads flip rate
47.2%, aggregate **52.9% A** — its "fair chaos" verdict. All three
rungs (416/384/352) sit within noise of each other, so the trail lever
showed no signal worth acting on. The 57–62% Outlier lean you ruled on
was REAL when measured, but the pacing era itself (B1 deaths, B3
mercy, field repair, pool 315) dissolved it before the lever ever
moved. §3.8's rebaseline rule, vindicated: the lean you are chasing
may already be gone.

Consequence: **blackwood is PROMOTED** (specs/10 §4d) — batteries,
corridors, and your playtest all green, band precondition met.
Riverline stays experimental (its battery is still owed); sawtooth
stays held for your playtest.

## Still with you

- **Sawtooth human playtest** — yours, when ready (`npm run start:sawtooth`).
- **Uncapped perf run** — `bash tools/perf_native.sh -Uncapped` after
  your vsync change.
- **Q24–Q26 above** (pool ratification, mercy's new prominence, award
  names + the missing escort counter).
