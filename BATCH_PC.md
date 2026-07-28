# Batch PC workflow — Ryzen 5600X / RTX 4070

How to commission the gaming PC for More Firepower batch work, and how the
results flow back. Two workload families: **CPU sim sweeps** (balance
census — the 5600X's job, one Node process per core) and **GPU client
perf** (the RTX 4070's job, via the Playwright harness).

## Windows or Linux? (read first)

The gaming PC is likely Windows. Split the workloads:
- **CPU sweeps + the agent-mail worker: run in WSL2** (Ubuntu) — the
  worker is bash, and the engine is pure Node either way.
- **GPU perf harness: run NATIVELY on Windows** (PowerShell) — Chromium
  under WSL2 usually falls back to software GL and the 4070 sits idle.
  The harness is pure Node + Playwright, no bash needed:
  `node tools\perf_harness.mjs` after `npm i -D playwright` +
  `npx playwright install chromium` in a native clone.

**Hub topology (FINAL, prompt 32):** firepower's hub runs on the DEV
machine, port 8971 (the sibling project keeps 8970 on the gaming PC).
The dev machine's local CLI uses the store directly (no remote file
there); the gaming PC points its remote at the dev machine.

```bash
# DEV machine (WSL) — start/confirm the hub any time:
bash tools/hub_up.sh          # starts the hub AND verifies the whole
                              # Windows path: portproxy freshness (the
                              # WSL IP changes every reboot — a stale
                              # proxy black-holes the hub silently) and
                              # the firewall rule. It prints the exact
                              # admin commands when something is off.
                              # "Worker can't reach the hub" => run this FIRST.
```

Because the hub lives inside WSL2, the DEV machine's WINDOWS side needs
two one-time ADMIN PowerShell commands (WSL IP changes after reboots —
re-run the portproxy line with the fresh IP from hub_up.sh):

```powershell
netsh interface portproxy add v4tov4 listenport=8971 listenaddress=0.0.0.0 connectport=8971 connectaddress=<WSL-IP>
netsh advfirewall firewall add rule name="firepower agent-mail hub" dir=in action=allow protocol=TCP localport=8971
```

```bash
# GAMING PC (WSL clone):
echo "http://<dev-machine-lan-ip>:8971" > .agent-mail/remote
bash tools/batch_worker.sh
```

## One-time setup on the PC

```bash
git clone <your-remote> firepower && cd firepower
git checkout dev_night            # current head: slice-12c (factions landed)
node --version                    # engine is tested on Node 20.x
npm install && npm test           # 431 tests; must be green before ANY
                                  # batch run — red invalidates results
# Only needed for the GPU perf harness (native Windows clone):
npm i -D playwright && npx playwright install chromium
```

No other dependencies. The engine is deterministic: same commit + same
seed = byte-identical war, so results are reproducible and attributable
to an exact tag. **Always record `git describe --tags` next to results.**

## The agent-mail flow (preferred once set up)

The repo now carries `tools/agent-mail.py` (single file, no deps). Jobs
travel as queue items; results come back as mail. **Round-trip verified
end to end on the dev machine.**

On the DEV machine (the hub lives on the GAMING PC — topology above):
```bash
bash tools/batch_send.sh sweep 600                # queue jobs...
bash tools/batch_send.sh mirror 600               # ...as many as you like
bash tools/batch_send.sh factionswap 300          # 12D fairness gate
bash tools/batch_send.sh matrix 2 100             # hard-AI variant
bash tools/batch_send.sh perf
bash tools/batch_send.sh board                    # who's doing what
bash tools/batch_send.sh collect                  # deliver + settle results
```

On the BATCH PC (after the one-time setup below):
```bash
# hub + remote pointer as in the topology section, then:
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
# 12D faction-fairness gate: the Sentinel/Skimmer pair trades sides.
FACTIONSWAP=1 node tools/sim_sweep.mjs 300 > reports/sweeps/factionswap.csv
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
**From the factionswap set (12D):** with Directorate/Outlier uniques now
live, compare win rates in `sweep.csv` vs `factionswap.csv` — a shift
that TRACKS the swap is Sentinel-vs-Skimmer imbalance, cleanly separated
from side bias. Analysis on the dev machine:
`python3 debugging/analyze_sweep.py reports/sweeps/sweep.csv reports/sweeps/mirror.csv`
(and run it again with `factionswap.csv` as a plain summary).

**Priority order if time is short:** sweep 600 → factionswap 300 →
mirror 600 → perf → difficulty matrix.

## Job 1.5 — client join-flow smoke (any machine with playwright)

```bash
node tools/client_smoke.mjs   # ~15 s: loads the client in Chromium, joins
                              # BOTH factions + spectator, dismisses the
                              # briefing, verifies the war ticks and that
                              # ZERO page errors fire. Run before any
                              # playtest session on a machine that has
                              # playwright — it catches load-order and
                              # DOM-wiring breakage that node tests
                              # structurally cannot.
```

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

## Getting results back (over the mail, prompt 41)

The worker now MAILS each merged CSV home (tag `csv`, `#file:` header);
on the dev machine `bash tools/batch_send.sh collect` settles the
summaries AND extracts the CSVs into `reports/sweeps/` from the local
store. `bash tools/batch_send.sh sendresults` queues a retroactive
"mail me everything on your disk" job. Perf JSON still copies by hand.

**Keep the worker current:** the PC worker only knows the job kinds its
CHECKOUT shipped with — after new worker features land here, queue
`batch_send.sh update` and it pulls and re-execs itself. A stale worker
politely refuses unknown jobs by mail — that refusal names its commit,
which is your version check.

**The `update` job handles a dirty worker (prompt 66).** Local edits on
the PC used to block every update until someone walked to the machine.
Now `update` stashes them, pulls, and restores them. Three cases, all
reported by mail:

| On the PC | What happens |
|---|---|
| Clean tree | Straight `git pull --ff-only`, re-exec. |
| Local EDITS | Autostashed, pulled, popped back. If the pop conflicts (your edit touched a file the pull moved) the worktree is HARD RESET to the clean pulled tree and your work is kept in the stash — because re-exec'ing into a tree full of conflict markers would break every later job. The mail names the stash ref. |
| Local COMMITS (diverged) | No stash can fix this; `--ff-only` refuses and the mail NAMES the local commits (`git log @{u}..HEAD`). Fix by hand: keep them (rebase/push) or `git reset --hard origin/dev_night`. |

Results are never at risk — `reports/sweeps/` is gitignored, so the
autostash (plain `git stash`, never `-u`) cannot touch a CSV. All three
paths are covered by `debugging/test_worker_autostash.sh` against real
git, because this code only ever runs on the PC and has blocked it twice.

**Job kinds as of slice-18b:** `sweep`, `mirror`, `factionswap`,
`map` (ANY profile — body takes `map` and optional `mirror` 0|1, e.g.
`{"kind":"map","map":"blackwood","count":300}`; this is how a new
profile earns promotion out of experimental), `riverline` (the older
single-map kind, kept for continuity), `uniques` (EXPLICIT
unique-crewing — since prompt-54 the default already has uniques ON, so
plain sweeps include them; this kind remains for swap/mirror diagnosis
runs; body takes `swap`/`mirror` 0|1 — `batch_send.sh uniques 300 1 0`
queues the swapped variant), `matrix`, `perf`, `sendresults`. The
refusal message lists the kinds a running worker actually has.

**Results come home automatically (prompt 73).** After EVERY job the
worker mails any new or changed file in `reports/sweeps/` — CSVs under
tag `csv`, JSON summaries under tag `report`. A manifest (`.mailed`)
means unchanged files are not re-sent, so the automatic pass is quiet
when nothing happened. This is what gets a **native perf run home**:
`perf_native.ps1` driven from WSL writes into this same clone, so the
next job the worker finishes ships `perf_summary.json` without anyone
queueing anything. `bash tools/batch_send.sh sendresults` force-resends
everything if a result is lost. `batch_collect.py` writes both tags into
`reports/sweeps/` on the dev side.

**Native GPU perf: use the PowerShell runner, not the worker job
(prompt 71).** The `perf` job runs inside WSL, which cannot reach the
discrete GPU, so Chromium falls back to SwiftShader and every number it
has ever produced measures a software rasteriser. For real numbers run
`tools/perf_native.ps1` on the Windows side:

```powershell
# on the PC, from the repo root
powershell -ExecutionPolicy Bypass -File tools\perf_native.ps1 -InstallDeps
```

```bash
# or straight from WSL, without leaving the shell
powershell.exe -ExecutionPolicy Bypass -File "$(wslpath -w tools/perf_native.ps1)"
```

It runs the SAME harness headed with ANGLE d3d11, refuses a node.exe
that turns out to live inside WSL, and **exits 2 if the summary still
names SwiftShader** — so a software run can never be mistaken for a
native one. Output: `reports/sweeps/perf.csv`, `perf_summary.json`, and
a timestamped copy per run. Note .ps1 files must stay pure ASCII
(a test enforces it): PowerShell 5.1 reads BOM-less files as
Windows-1252, and a single em dash silently terminates a string.

**Perf prerequisite (learned 2026-07-27):** the perf job needs Playwright
ON THE WORKER MACHINE — first run failed with "is playwright installed?".
One-time on the PC, in the repo: `npx playwright install chromium`.
