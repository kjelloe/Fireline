#!/bin/bash
# debugging/local_riverline_census.sh — 300-war riverline census (open
# question: standard-run viability on the bridge map — do wars ever end
# by standard capture, or is riverline horn-bound?). Same shard/merge
# idiom as local_verify_16a.sh.
set -eu
cd "$(dirname "$0")/.."
OUT=reports/sweeps
mkdir -p "$OUT"
shards=${SHARDS_OVERRIDE:-8}
label=riverline_local
pids=()
for i in $(seq 0 $((shards - 1))); do
  MAP=riverline DIFFICULTY=1 SHARDS=$shards SHARD=$i \
    node tools/sim_sweep.mjs 300 > "$OUT/${label}_$i.csv" &
  pids+=($!)
done
wait "${pids[@]}"
head -1 "$OUT/${label}_0.csv" > "$OUT/${label}.csv"
for i in $(seq 0 $((shards - 1))); do
  tail -n +2 "$OUT/${label}_$i.csv" >> "$OUT/${label}.csv"
  rm "$OUT/${label}_$i.csv"
done
echo "RIVERLINE CENSUS COMPLETE ($(tail -n +2 "$OUT/${label}.csv" | wc -l) wars)"
