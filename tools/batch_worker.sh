#!/bin/bash
# tools/batch_worker.sh — the BATCH_PC job lane (prompt 20: agent-mail
# semantics). Runs on the gaming PC: sits in a blocking `flag wait`,
# takes queued jobs, executes them, and mails the results back.
#
#   bash tools/batch_worker.sh            # loop forever
#   ONCE=1 bash tools/batch_worker.sh     # drain the queue once and exit
#
# Job body = one JSON object queued by tools/batch_send.sh:
#   {"kind":"sweep","count":600}            CPU census, auto-sharded
#   {"kind":"mirror","count":600}           sides-swapped run (question 18)
#   {"kind":"matrix","difficulty":2,"count":100}
#   {"kind":"perf"}                         Playwright+WebGL harness
# Anything else is refused by mail — the worker never runs arbitrary text.
#
# Delivery is at-least-once: every job is idempotent (same commit + same
# seeds = same wars), so seeing a job twice costs time, not correctness.

set -u
cd "$(dirname "$0")/.."
AM="python3 tools/agent-mail.py"
ME=batch-pc
OUT=reports/sweeps
mkdir -p "$OUT"

TAG=$(git describe --tags --always)
$AM status --as $ME "worker up on $TAG; validating suite" >/dev/null

# A red suite invalidates every result — refuse to serve until green.
if ! npm test >/dev/null 2>&1; then
  $AM send --from $ME --to dev --tag done "WORKER REFUSED: npm test is RED on $TAG — fix the tree before batching."
  exit 1
fi
$AM status --as $ME "idle on $TAG; waiting for jobs" >/dev/null

cores=$(nproc 2>/dev/null || echo 4)
shards=$(( cores > 2 ? cores - 1 : 2 ))

run_sweep() { # $1=count  $2=mirror(0/1)  $3=difficulty  $4=label
  # FACTIONSWAP may arrive via the environment (factionswap job kind).
  local count=$1 mirror=$2 diff=$3 label=$4
  $AM status --as $ME "running $label ($count wars, $shards shards) on $TAG" >/dev/null
  local pids=()
  for i in $(seq 0 $((shards - 1))); do
    FACTIONSWAP=${FACTIONSWAP:-0} MIRROR=$mirror DIFFICULTY=$diff SHARDS=$shards SHARD=$i \
      node tools/sim_sweep.mjs "$count" > "$OUT/${label}_$i.csv" &
    pids+=($!)
  done
  wait "${pids[@]}"
  # Merge shards: one header, all rows.
  head -1 "$OUT/${label}_0.csv" > "$OUT/${label}.csv"
  for i in $(seq 0 $((shards - 1))); do
    tail -n +2 "$OUT/${label}_$i.csv" >> "$OUT/${label}.csv"
    rm "$OUT/${label}_$i.csv"
  done
  local wars aWins bWins
  wars=$(tail -n +2 "$OUT/${label}.csv" | wc -l)
  aWins=$(tail -n +2 "$OUT/${label}.csv" | awk -F, '$5==0' | wc -l)
  bWins=$(tail -n +2 "$OUT/${label}.csv" | awk -F, '$5==1' | wc -l)
  $AM send --from $ME --to dev --tag done \
    "$label done on $TAG: $wars wars, A wins $aWins, B wins $bWins, rest undecided. CSV: $OUT/${label}.csv"
  mail_csv "$OUT/${label}.csv"
}

# Ship a CSV home as mail: first line names the file, the rest is data.
mail_csv() {
  local file=$1
  [ -f "$file" ] || return 0
  local tmp
  tmp=$(mktemp)
  { echo "#file:$(basename "$file")"; cat "$file"; } > "$tmp"
  $AM send --from $ME --to dev --tag csv --body-file "$tmp" >/dev/null
  rm -f "$tmp"
}

handle_job() { # $1 = JSON body
  local body=$1
  local kind
  kind=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('kind',''))" "$body" 2>/dev/null)
  case "$kind" in
    sweep)
      run_sweep "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',100))" "$body")" 0 1 sweep ;;
    mirror)
      run_sweep "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',100))" "$body")" 1 1 mirror ;;
    factionswap)
      FACTIONSWAP=1 run_sweep "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',100))" "$body")" 0 1 factionswap ;;
    matrix)
      local d
      d=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('difficulty',1))" "$body")
      run_sweep "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',100))" "$body")" 0 "$d" "matrix_d$d" ;;
    sendresults)
      # Retroactive: mail home every CSV already on this disk.
      local sent=0 2>/dev/null || sent=0
      for f in "$OUT"/*.csv; do
        [ -f "$f" ] && mail_csv "$f" && sent=$((sent+1))
      done
      $AM send --from $ME --to dev --tag done "sendresults: mailed $sent CSVs from $TAG" ;;
    perf)
      $AM status --as $ME "running perf harness on $TAG" >/dev/null
      if node tools/perf_harness.mjs > "$OUT/perf_run.log" 2>&1; then
        $AM send --from $ME --to dev --tag done \
          "perf done on $TAG: $(cat "$OUT/perf_summary.json" 2>/dev/null | head -c 400). CSV: $OUT/perf.csv"
      else
        $AM send --from $ME --to dev --tag done \
          "perf FAILED on $TAG — see $OUT/perf_run.log (is playwright installed?)"
      fi ;;
    *)
      $AM send --from $ME --to dev --tag done \
        "job refused (unknown kind): $body — the worker only runs sweep/mirror/matrix/perf." ;;
  esac
  $AM status --as $ME "idle on $TAG; waiting for jobs" >/dev/null
}

while true; do
  job=$($AM queue take --as $ME 2>/dev/null)
  if [ -n "$job" ] && ! printf '%s' "$job" | grep -q "queue empty"; then
    body=$(printf '%s' "$job" | python3 -c "
import sys, re
text = sys.stdin.read()
m = re.search(r'\{.*\}', text, re.S)
print(m.group(0) if m else '')")
    [ -n "$body" ] && handle_job "$body"
    continue # drain the queue before waiting
  fi
  [ "${ONCE:-0}" = "1" ] && break
  # Blocking idle loop: returns the moment mail/queue arrives (or timeout).
  $AM flag wait --as $ME --timeout 3300 >/dev/null 2>&1 || true
done
$AM status --as $ME "worker stopped ($TAG)" >/dev/null
