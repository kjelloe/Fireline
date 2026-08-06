# Resource profile — RAM/CPU per war, per map, per player (prompt 207)

Tool: `node --expose-gc tools/profile_run.mjs` (per-map full-war
headless profile) and `--players N` (real server + N ws clients, the
marginal human cost). Measured 2026-08-06 on the WSL dev box — the
Hetzner vCPU is slower (assume 2-3x the CPU numbers there), but the
MEMORY numbers transfer directly.

## Per map — one full AI war, headless, seed 2026

| map | ticks to end | peak heap MB | cpu µs/tick | live CPU (10 t/s) | view build/broadcast |
|---|---|---|---|---|---|
| frontier_corridor | 13,340 | 62 | 818 | 0.8% of a core | 0.02 ms |
| blackwood | 13,440 | 63 | 891 | 0.9% | 0.02 ms |
| riverline | 11,100 | 66 | 877 | 0.9% | 0.03 ms |
| sawtooth | 9,820 | 65 | 1,060 | 1.1% | 0.02 ms |
| caldera | 2,406 | 52 | 1,231 | 1.2% | 0.02 ms |

Fresh-process RSS peaked ~242 MB on the first war (Node baseline +
module load + V8 warmup + one full war). Later same-process wars added
15-190 MB of RSS *fragmentation* while heap stayed ≤66 MB — RSS is a
high-water mark, not live data; the 384 MB heap cap forces collection
long before the 512 MB unit cap.

Map spread is real but small: sawtooth/caldera cost ~40% more CPU per
tick (dense contact, more collisions/AI work); caldera wars are short.

## Per human player — real server, real ws transport

| clients | RSS per player | CPU per player | whole-server CPU |
|---|---|---|---|
| 8 | ~0.9 MB | ~0.33% of a core | 5.4% |
| 16 | ~0.5 MB | ~0.37% of a core | 9.0% |

**Answer to "does player count increase memory?": yes, but trivially —
~0.5-1 MB per connected player** (a ws session + send buffers). Engine
state does not grow: all 32 operators are preallocated, and views are
built per TEAM, not per player. The real per-player cost is CPU
(per-socket JSON serialization), ~0.35% of a core each — a FULL
16-human server adds ~6% of one core.

## Co-hosting budget (what to reserve per Fireline instance)

- **RAM: 512 MB MemoryMax is comfortable** — worst observed RSS ~440 MB
  after five consecutive wars in one process without restarts, heap
  never above 66 MB, heap-capped at 384 MB. Could drop to 384 MB
  MemoryMax (+ heap cap 288) if the box gets tight; 256 MB would be
  gambling against RSS fragmentation.
- **CPU: ~1% of a core idle-war, ~7-10% fully loaded with humans** on
  dev hardware — call it **≤25% of one Hetzner vCPU worst case**. The
  unit's CPUQuota=50% is generous; 25% would also be safe.
- Disk: REPLAY_KEEP=200 caps the archive (each replay = one war's
  commandLog, ~1-4 MB JSON judging by 3.4k-18k entries/war).

To profile a sibling the same way: the tool is ~140 lines against the
engine API (step loop + process.memoryUsage/cpuUsage) — the pattern
ports to any headless-steppable game server.
