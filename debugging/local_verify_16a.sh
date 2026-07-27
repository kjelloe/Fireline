#!/bin/bash
# debugging/local_verify_16a.sh — local verification of the tick-parity
# fairness fix (slice-16a): 600 normal + 600 mirrored wars, sharded across
# local cores, into reports/sweeps/local_16a_{sweep,mirror}.csv. Same
# shard/merge idiom as tools/batch_worker.sh run_sweep.
set -eu
cd "$(dirname "$0")/.."
OUT=reports/sweeps
mkdir -p "$OUT"
shards=${SHARDS_OVERRIDE:-8}

run_local() { # $1=count $2=mirror(0/1) $3=label
  local count=$1 mirror=$2 label=$3
  local pids=()
  for i in $(seq 0 $((shards - 1))); do
    MIRROR=$mirror DIFFICULTY=1 SHARDS=$shards SHARD=$i \
      node tools/sim_sweep.mjs "$count" > "$OUT/${label}_$i.csv" &
    pids+=($!)
  done
  wait "${pids[@]}"
  head -1 "$OUT/${label}_0.csv" > "$OUT/${label}.csv"
  for i in $(seq 0 $((shards - 1))); do
    tail -n +2 "$OUT/${label}_$i.csv" >> "$OUT/${label}.csv"
    rm "$OUT/${label}_$i.csv"
  done
  echo "done: $label ($(tail -n +2 "$OUT/${label}.csv" | wc -l) wars)"
}

run_local 600 0 local_16a_sweep
run_local 600 1 local_16a_mirror
echo "VERIFY-16A COMPLETE"
