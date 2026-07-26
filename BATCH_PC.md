# Batch PC workflow — Ryzen 5600X / RTX 4070

How to commission the gaming PC for More Firepower batch work, and how the
results flow back. Two workload families: **CPU sim sweeps** (balance
census — the 5600X's job, one Node process per core) and **GPU client
perf** (the RTX 4070's job, via the Playwright harness).

## One-time setup on the PC

```bash
git clone <repo> firepower && cd firepower
git checkout dev_night            # or the tag under study, e.g. slice-11f
node --version                    # engine is tested on Node 20.x
npm test                          # must be green before ANY batch run —
                                  # a red suite invalidates every result
# Only needed for the GPU perf harness:
npm i -D playwright && npx playwright install chromium
```

No other dependencies. The engine is deterministic: same commit + same
seed = byte-identical war, so results are reproducible and attributable
to an exact tag. **Always record `git describe --tags` next to results.**

## The agent-mail flow (preferred once set up)

The repo now carries `tools/agent-mail.py` (single file, no deps). Jobs
travel as queue items; results come back as mail. **Round-trip verified
end to end on the dev machine.**

On the DEV machine (hub host):
```bash
python3 tools/agent-mail.py serve --port 8970 &   # the shared hub
bash tools/batch_send.sh sweep 600                # queue jobs...
bash tools/batch_send.sh mirror 600               # ...as many as you like
bash tools/batch_send.sh perf
bash tools/batch_send.sh board                    # who's doing what
bash tools/batch_send.sh collect                  # deliver + settle results
```

On the BATCH PC (after the one-time setup below):
```bash
echo "http://<dev-machine>:8970" > .agent-mail/remote
bash tools/batch_worker.sh                        # sits in flag-wait, forever
```

The worker refuses to serve on a red test suite, posts its status while
running, auto-shards sweeps across its cores, merges the CSVs, and mails
back a one-line summary per job (`ONCE=1` drains the queue once for
testing). Delivery is at-least-once and every job is idempotent by seed,
so a redelivered job costs time, never correctness. The manual commands
below remain valid without the hub.

## Job 1 — balance census (CPU, ~overnight)

600 full wars, six shards (one per physical core), plus the mirrored run
that answers question 18 (geometry vs doctrine bias):

```bash
mkdir -p reports/sweeps
for i in 0 1 2 3 4 5; do
  SHARDS=6 SHARD=$i node tools/sim_sweep.mjs 600 > reports/sweeps/sweep_$i.csv &
done; wait
for i in 0 1 2 3 4 5; do
  MIRROR=1 SHARDS=6 SHARD=$i node tools/sim_sweep.mjs 600 > reports/sweeps/mirror_$i.csv &
done; wait
DIFFICULTY=2 node tools/sim_sweep.mjs 100 > reports/sweeps/hard.csv
DIFFICULTY=0 node tools/sim_sweep.mjs 100 > reports/sweeps/easy.csv
```

CSV columns: `seed,mirror,difficulty,ticks,winner,reason,scoreA,scoreB,
tows,restored,rescued,downs,mines,detonations,captures,shells`.
Rough sizing: one 18000-tick war ≈ 15–60 s on a 5600X core → 600 wars
across 6 shards ≈ 1–2 h per family.

**What we'll read from it:** winner rate A/B (fair map ⇒ near 50/50 at
scale), war-length distribution, win-reason mix (standard capture vs
domination vs horn), how often mines/tows/downs actually shape wars, and
— from the mirror set — whether any residual bias flips with the sides
(flips ⇒ geometry/fixedmath; survives ⇒ doctrine/order-of-execution).

## Job 2 — client render perf (GPU)

```bash
node tools/perf_harness.mjs                 # full run: server + Chromium + CSV
DRY_RUN=1 node tools/perf_harness.mjs       # no browser: validates the scene only
HEADED=1 node tools/perf_harness.mjs        # watch it render (debugging)
```

What it does: starts the real server with AI enabled, stages a
**worst-case theater** on top of the live war (all 32 assets operable and
labeled, 24 armed mines visible, 8 drones aloft, active pings), connects
Chromium as a **spectator** (sees everything — the maximum-draw view), and
samples per-second FPS plus three.js renderer stats (draw calls,
triangles) for 30 s. Output: `reports/sweeps/perf.csv` + a JSON summary
(median/p5 fps). Run once headless and once `HEADED=1` sanity-check;
note GPU utilization if you can. On this machine the interesting
questions are: median fps at the theater scene, and whether draw calls
scale with label count (the world-label sprites are the suspect).

## Getting results back

Commit nothing from the PC. Copy `reports/sweeps/*.csv` (and the perf
JSON) back to the dev machine — paste or drop them into
`reports/sweeps/` here and tell Claude which tag produced them; analysis
scripts live in `debugging/` and the findings go into the next session
report.
