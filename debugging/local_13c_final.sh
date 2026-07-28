#!/bin/bash
# debugging/local_13c_final.sh — the 13C acceptance battery: frontier
# 300 + mirror 300 on the FULL doctrine (equivariant routing + rearguard
# + roleTruck). Riverline halves come from the b87fpafgo battery.
set -eu
cd "$(dirname "$0")/.."
OUT=reports/sweeps
run_one() { local pids=(); for i in $(seq 0 7); do MAP=$1 MIRROR=$2 SHARDS=8 SHARD=$i node tools/sim_sweep.mjs 300 > "$OUT/$3_$i.csv" & pids+=($!); done; wait "${pids[@]}"; head -1 "$OUT/$3_0.csv" > "$OUT/$3.csv"; for i in $(seq 0 7); do tail -n +2 "$OUT/$3_$i.csv" >> "$OUT/$3.csv"; rm "$OUT/$3_$i.csv"; done; echo "done $3"; }
run_one frontier_corridor 0 f13c_final
run_one frontier_corridor 1 f13c_final_mirror
echo FINAL-13C-BATTERY-COMPLETE
