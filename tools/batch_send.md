# batch_send.sh — queueing batch jobs and collecting results

Dev-machine side of the agent-mail batch flow. You queue jobs from here; a
worker on the batch PC (`tools/batch_worker.sh`, role `batch-pc`) drains the
queue, runs the sims, and mails back a one-line summary per job. See
`BATCH_PC.md` for hub topology and the worker/perf-harness setup.

## Prerequisites

- The firepower hub is serving and `.agent-mail/remote` on BOTH boxes points
  at it (e.g. `http://192.168.1.112:8971` — NOT the sibling hub on 8970).
- The worker is up on the batch PC and shows `idle … waiting for jobs`
  (`bash tools/batch_send.sh board`).
- The batch PC has run `npm install`; the worker refuses to serve on a red
  `npm test`.

## Commands

```bash
bash tools/batch_send.sh sweep 600         # balance census — 600 full wars
bash tools/batch_send.sh factionswap 300   # 12D fairness gate (Sentinel<->Skimmer trade sides)
bash tools/batch_send.sh mirror 600        # question 18 — geometry vs doctrine (sides swapped)
bash tools/batch_send.sh matrix 2 100      # difficulty matrix: hard AI (2), 100 wars
bash tools/batch_send.sh perf              # GPU render harness — see caveat below
bash tools/batch_send.sh board             # who's doing what (status + queue)
bash tools/batch_send.sh collect           # deliver + ack the done-tagged results
```

The count arg is optional (defaults to 100). Each command just appends one
JSON job to the worker's queue; the worker drains them in FIFO order.

## A typical overnight run

Queue the priority chain (sweep → factionswap → mirror) and walk away:

```bash
bash tools/batch_send.sh sweep 600
bash tools/batch_send.sh factionswap 300
bash tools/batch_send.sh mirror 600
bash tools/batch_send.sh board        # confirm: running sweep, 2 queued
```

In the morning:

```bash
bash tools/batch_send.sh collect      # pulls all three summaries
```

Result CSVs land on the batch PC at `reports/sweeps/{sweep,factionswap,
mirror}.csv`. Copy them back to the dev machine's `reports/sweeps/` for
analysis (`debugging/analyze_sweep.py sweep.csv mirror.csv`).

## Smoke test before a long run

Queue a tiny sweep and confirm the round-trip before committing to the 600s:

```bash
bash tools/batch_send.sh sweep 12
bash tools/batch_send.sh board        # worker goes running -> idle
bash tools/batch_send.sh collect      # expect: "sweep done on <tag>: 12 wars, A wins .., B wins .."
```

## Notes

- **`perf` will fail on a WSL2 worker** (software GL, GPU idle). Run the perf
  harness natively on Windows per `BATCH_PC.md`, not through the mail worker.
- **Attribution:** results are only meaningful against a known commit. The
  worker stamps every summary with `git describe --tags --always`; record it
  next to any CSV you keep.
- **Idempotent by seed:** same commit + same seed = byte-identical war.
  Delivery is at-least-once, so a redelivered job costs time, never
  correctness. Re-queue freely if in doubt.
- **`collect` acks** the messages it delivers, so they won't come back. Use
  `board` (or `agent-mail.py peek --as dev --tag done`) to look without
  acking.
