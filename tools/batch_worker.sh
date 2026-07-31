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
#   {"kind":"pool","ticketPool":350,"count":300}   pacing battery (prompt 88)
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

# prompt-74: this thing runs unattended on another machine, so "it was
# running and there were no errors in the log" has to mean something.
#   --verbose / -v   narrate every decision to stdout + reports/sweeps/worker.log
#   --debug          --verbose plus a full shell trace (set -x)
# VERBOSE=1 / DEBUG=1 in the environment work too, for the systemd case.
VERBOSE=${VERBOSE:-0}
DEBUG=${DEBUG:-0}
for arg in "$@"; do
  case "$arg" in
    --verbose|-v) VERBOSE=1 ;;
    --debug|-d)   VERBOSE=1; DEBUG=1 ;;
    --help|-h)
      echo "usage: batch_worker.sh [--verbose|-v] [--debug|-d]"
      echo "  env: ONCE=1 drain the queue once; VERBOSE=1; DEBUG=1"
      exit 0 ;;
    *) echo "unknown argument: $arg (try --help)" >&2; exit 2 ;;
  esac
done
WORKER_LOG="$OUT/worker.log"

log() { # always to the log file; to stdout only when verbose
  local line
  line="$(date '+%Y-%m-%d %H:%M:%S') $*"
  printf '%s\n' "$line" >> "$WORKER_LOG" 2>/dev/null || true
  [ "$VERBOSE" = "1" ] && printf '%s\n' "$line"
  return 0
}
# A failure that reaches nobody is the thing we are fixing: say it on
# stderr, put it in the log, AND mail it home.
fail_loud() {
  local msg="$*"
  printf 'ERROR: %s\n' "$msg" >&2
  log "ERROR: $msg"
  $AM send --from $ME --to dev --tag done "worker ERROR on ${TAG:-?}: $msg" >/dev/null 2>&1 || true
}
[ "$DEBUG" = "1" ] && set -x
log "worker starting (verbose=$VERBOSE debug=$DEBUG pid=$$)"

TAG=$(git describe --tags --always)
$AM status --as $ME "worker up on $TAG; validating suite" >/dev/null

# A red suite invalidates every result — refuse to serve until green.
log "validating suite on $TAG"
if ! npm test > "$OUT/worker_suite.log" 2>&1; then
  # The failing lines, not just the verdict - otherwise diagnosing a red
  # PC means asking a human to go and look.
  suite_tail=$(grep -E "^not ok|^# (fail|tests|pass)" "$OUT/worker_suite.log" | head -12 | tr '\n' ' ')
  fail_loud "npm test is RED on $TAG - refusing to serve. ${suite_tail:0:400}"
  exit 1
fi
log "suite green"
# Online notice as MAIL (prompt 47): the dev side watches the store, so
# "worker online on <commit>" is the signal to queue the next slate —
# no human relay needed. Status alone is a board, not a notification.
$AM send --from $ME --to dev --tag done "worker online on $TAG — suite green, $(nproc 2>/dev/null || echo '?') cores" >/dev/null
$AM status --as $ME "idle on $TAG; waiting for jobs" >/dev/null

cores=$(nproc 2>/dev/null || echo 4)
shards=$(( cores > 2 ? cores - 1 : 2 ))

run_sweep() { # $1=count  $2=mirror(0/1)  $3=difficulty  $4=label
  # FACTIONSWAP may arrive via the environment (factionswap job kind).
  local count=$1 mirror=$2 diff=$3 label=$4
  $AM status --as $ME "running $label ($count wars, $shards shards) on $TAG" >/dev/null
  local pids=()
  for i in $(seq 0 $((shards - 1))); do
    FACTIONSWAP=${FACTIONSWAP:-0} UNIQUES=${UNIQUES:-0} MAP=${MAP:-frontier_corridor} TICKETPOOL=${TICKETPOOL:-} SKIMTRAIL=${SKIMTRAIL:-} MIRROR=$mirror DIFFICULTY=$diff SHARDS=$shards SHARD=$i \
      node tools/sim_sweep.mjs "$count" > "$OUT/${label}_$i.csv" &
    pids+=($!)
  done
  local rc=0 bad=0
  for pid in "${pids[@]}"; do
    wait "$pid" || { rc=$?; bad=$((bad + 1)); }
  done
  if [ "$bad" -gt 0 ]; then
    # Shards that die produce empty CSVs and a cheerful "0 wars" mail.
    fail_loud "$label: $bad/$shards shard(s) exited non-zero (last rc=$rc) - results are INCOMPLETE"
  fi
  log "$label: shards finished ($((shards - bad))/$shards ok)"
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

# Ship a report home as mail: first line names the file, the rest is
# data. Used for sweep CSVs and (prompt 73) for anything else that lands
# in reports/ - notably perf_summary.json from the native GPU runner,
# which writes into this same clone when perf_native.ps1 is driven from
# WSL. reports/sweeps is gitignored, so mail is the ONLY way results
# reach the dev machine.
#
# A manifest prevents re-sending: a file is mailed when it is new or has
# changed (size or mtime), so the automatic pass after every job is
# quiet when nothing happened. FORCE=1 re-sends regardless.
MANIFEST="$OUT/.mailed"

mail_file() { # $1 = path, $2 = tag (csv|report)
  local file=$1 tag=${2:-report}
  [ -f "$file" ] || return 1
  local base sig
  base=$(basename "$file")
  sig="$base|$(stat -c '%s|%Y' "$file" 2>/dev/null || echo '?')"
  if [ "${FORCE:-0}" != "1" ] && [ -f "$MANIFEST" ] && grep -qxF "$sig" "$MANIFEST"; then
    return 1 # already mailed, unchanged
  fi
  local tmp
  tmp=$(mktemp)
  # Logs can be enormous; results never are. Cap the body so one runaway
  # file cannot wedge the mail store.
  { echo "#file:$base"; head -c 200000 "$file"; } > "$tmp"
  if ! $AM send --from $ME --to dev --tag "$tag" --body-file "$tmp" >/dev/null 2>&1; then
    rm -f "$tmp"
    # NOT recorded in the manifest, so the next pass retries instead of
    # believing a failed send succeeded.
    fail_loud "failed to mail $base - will retry on the next job"
    return 1
  fi
  rm -f "$tmp"
  log "mailed $base (tag=$tag)"
  # Record only AFTER a successful send, and drop any older line for the
  # same file so the manifest cannot grow without bound.
  if [ -f "$MANIFEST" ]; then
    grep -vF "$base|" "$MANIFEST" > "$MANIFEST.tmp" 2>/dev/null || true
    mv "$MANIFEST.tmp" "$MANIFEST"
  fi
  echo "$sig" >> "$MANIFEST"
  return 0
}

mail_csv() { mail_file "$1" csv; }

# Mail every NEW or CHANGED report on this disk. Called automatically
# after each job, so a perf run (or anything else that drops a file in
# reports/) reaches the dev machine without a follow-up job.
mail_reports() {
  local sent=0 f
  for f in "$OUT"/*.csv "$OUT"/*.json; do
    [ -f "$f" ] || continue
    case "$(basename "$f")" in
      .mailed) continue ;;
    esac
    if mail_file "$f" "$([ "${f##*.}" = csv ] && echo csv || echo report)"; then
      sent=$((sent + 1))
    fi
  done
  echo "$sent"
}

handle_job() { # $1 = JSON body
  local body=$1
  local kind
  kind=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('kind',''))" "$body" 2>/dev/null)
  log "handling job kind='${kind:-<unparsed>}'"
  case "$kind" in
    sweep)
      run_sweep "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',100))" "$body")" 0 1 sweep ;;
    mirror)
      run_sweep "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',100))" "$body")" 1 1 mirror ;;
    factionswap)
      FACTIONSWAP=1 run_sweep "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',100))" "$body")" 0 1 factionswap ;;
    riverline)
      MAP=riverline run_sweep "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',100))" "$body")" 0 1 riverline ;;
    map)
      # 18B: generic per-profile battery — {"kind":"map","map":"blackwood",
      # "count":300,"mirror":0}. Covers every registered profile without a
      # new job kind per map. Optional "uniques":1 runs the LIVE game
      # config (16B crewing on) — default stays 0 so old batteries remain
      # comparable; label gains _uq so the two configs never mix in a CSV.
      local mp mp_mirror mp_uq mp_swap
      mp=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('map','frontier_corridor'))" "$body")
      mp_mirror=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('mirror',0))" "$body")
      mp_uq=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('uniques',0))" "$body")
      mp_swap=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('swap',0))" "$body")
      MAP=$mp UNIQUES=$mp_uq FACTIONSWAP=$mp_swap run_sweep \
        "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',100))" "$body")" \
        "$mp_mirror" 1 "map_${mp}$([ "$mp_uq" = 1 ] && echo _uq)$([ "$mp_swap" = 1 ] && echo _swap)$([ "$mp_mirror" = 1 ] && echo _mirror)" ;;
    uniques)
      # 16B chase: unique crewing ON; body may add "swap":1 or "mirror":1.
      local uq_swap uq_mirror
      uq_swap=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('swap',0))" "$body")
      uq_mirror=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('mirror',0))" "$body")
      UNIQUES=1 FACTIONSWAP=$uq_swap run_sweep \
        "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',100))" "$body")" \
        "$uq_mirror" 1 "uniques$([ "$uq_swap" = 1 ] && echo _swap)$([ "$uq_mirror" = 1 ] && echo _mirror)" ;;
    pool)
      # prompt-88 pacing battery: {"kind":"pool","ticketPool":350,
      # "count":300,"map":"frontier_corridor"}. Overrides the session
      # ticket pool via TICKETPOOL=. UNIQUES is pinned ON because the
      # local probes this battery must be comparable with ran the live
      # game config (uniques crew by default since 16B) — the worker's
      # legacy UNIQUES=0 default would measure a different game.
      local tp tp_map
      tp=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('ticketPool',300))" "$body")
      tp_map=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('map','frontier_corridor'))" "$body")
      TICKETPOOL=$tp UNIQUES=1 MAP=$tp_map run_sweep \
        "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',300))" "$body")" \
        0 1 "pool_${tp}" ;;
    skimtrail)
      # Band retune: {"kind":"skimtrail","speed":384,"count":300,
      # "mirror":0}. Live config (uniques ON — the lever IS a unique),
      # frontier. Label carries the value so rungs never mix.
      local st st_mirror
      st=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('speed',416))" "$body")
      st_mirror=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('mirror',0))" "$body")
      SKIMTRAIL=$st UNIQUES=1 run_sweep \
        "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',300))" "$body")" \
        "$st_mirror" 1 "skimtrail_${st}$([ "$st_mirror" = 1 ] && echo _mirror)" ;;
    pows)
      # Q46 battery: {"kind":"pows","n":2,"count":300,"mirror":0}.
      # Pre-placed captives (the designed POW experience) at scale, live
      # config, frontier — judges the powPreplaced default flip.
      local pw pw_mirror
      pw=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('n',2))" "$body")
      pw_mirror=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('mirror',0))" "$body")
      POWS=$pw UNIQUES=1 run_sweep \
        "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',300))" "$body")" \
        "$pw_mirror" 1 "pows_${pw}$([ "$pw_mirror" = 1 ] && echo _mirror)" ;;
    convoy)
      # Convoy Escort battery: {"kind":"convoy","attacker":0,"count":300}.
      # Mode wars, live config, frontier. Run both attacker sides.
      local cva
      cva=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('attacker',0))" "$body")
      MODE=convoy MODEATTACKER=$cva UNIQUES=1 run_sweep \
        "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',300))" "$body")" \
        0 1 "convoy_att${cva}" ;;
    ab)
      # Bisection rung: {"kind":"ab","raidparty":0,"powarc":1,
      # "count":300,"label":"ab_raidparty0"}. Whitelisted env only.
      local ab_rp ab_pa ab_label
      ab_rp=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('raidparty',1))" "$body")
      ab_pa=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('powarc',1))" "$body")
      ab_label=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('label','ab'))" "$body")
      RAIDPARTY=$ab_rp POWARC=$ab_pa UNIQUES=1 run_sweep \
        "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',300))" "$body")" \
        0 1 "$ab_label" ;;
    matrix)
      local d
      d=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('difficulty',1))" "$body")
      run_sweep "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('count',100))" "$body")" 0 "$d" "matrix_d$d" ;;
    sendresults)
      # Retroactive: mail home EVERY report on this disk (csv + json),
      # ignoring the already-sent manifest - this kind exists precisely
      # for "send it again, I lost it".
      local sent
      sent=$(FORCE=1 mail_reports)
      $AM send --from $ME --to dev --tag done "sendresults: mailed $sent reports from $TAG" ;;
    update)
      # Self-update (prompt 47): pull and RE-EXEC — the fresh process
      # re-validates the suite and mails "worker online on <new commit>".
      # ff-only so a diverged PC checkout fails loudly instead of merging.
      #
      # prompt-66: AUTOSTASH. Local edits on the worker (a debug print, a
      # stray whitespace fix) used to block every update until someone
      # walked to the PC. Now they are stashed, the pull runs, and the
      # stash is restored. Results are safe either way: OUT=reports/sweeps
      # is gitignored, so a plain `git stash` (never -u) cannot touch a CSV.
      local pullmsg stashed=0 dirty
      dirty=$(git status --porcelain --untracked-files=no 2>/dev/null)
      if [ -n "$dirty" ]; then
        if git stash push -m "batch_worker autostash" >/dev/null 2>&1; then
          stashed=1
        else
          $AM send --from $ME --to dev --tag done \
            "update FAILED on $TAG: worktree dirty and 'git stash' refused it — needs a human on the PC."
          $AM status --as $ME "idle on $TAG; waiting for jobs" >/dev/null
          return
        fi
      fi
      if pullmsg=$(git pull --ff-only 2>&1); then
        # Restore local work BEFORE re-exec. If the stashed edit touches a
        # file the pull also moved, `git stash pop` CONFLICTS: it leaves
        # conflict markers in the worktree and keeps the stash entry.
        # Re-exec'ing into a tree full of <<<<<<< would break every job,
        # so on conflict we hard-reset back to the clean pulled tree —
        # nothing is lost, the work is still in the stash for a human.
        local popnote=""
        if [ "$stashed" = 1 ]; then
          if git stash pop >/dev/null 2>&1; then
            popnote=" (autostash restored)"
          else
            git reset --hard HEAD >/dev/null 2>&1
            popnote=" (autostash CONFLICTED with upstream — worktree reset clean; your edits are safe in $(git stash list | head -1 | cut -d: -f1), apply them by hand)"
          fi
        fi
        $AM send --from $ME --to dev --tag done \
          "updating: $TAG -> $(git describe --tags --always)$popnote; re-exec" >/dev/null
        exec bash "$0"
      else
        # Pull refused with a CLEAN tree = real divergence (local commits),
        # which no stash can fix. Name the commits so the fix is obvious.
        [ "$stashed" = 1 ] && git stash pop >/dev/null 2>&1
        local ahead=""
        ahead=$(git log --oneline @{u}..HEAD 2>/dev/null | head -3 | tr '\n' ' ')
        $AM send --from $ME --to dev --tag done \
          "update FAILED on $TAG: ${pullmsg:0:180}${ahead:+ | local commits ahead: $ahead}"
      fi ;;
    resync)
      # prompt-83: the permanent answer to a DIVERGED worker. `update`
      # deliberately refuses to merge, and after a rebase upstream the
      # PC's old commits can never fast-forward — which has now blocked
      # the lane twice. This discards local history and matches upstream
      # exactly.
      #
      # Safe here in a way it would NOT be on a dev machine: the worker
      # authors nothing, and its only valuable output (reports/sweeps
      # CSVs) is gitignored, so `reset --hard` cannot touch a result.
      # Still explicit and opt-in — never folded into `update`.
      local branch fetchmsg before
      before=$(git describe --tags --always)
      branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo dev_night)
      if ! fetchmsg=$(git fetch origin 2>&1); then
        fail_loud "resync: fetch failed: ${fetchmsg:0:200}"
        $AM status --as $ME "idle on $TAG; waiting for jobs" >/dev/null
        return
      fi
      if git reset --hard "origin/$branch" >/dev/null 2>&1; then
        log "resync: $before -> $(git describe --tags --always) (hard reset to origin/$branch)"
        $AM send --from $ME --to dev --tag done \
          "resync: $before -> $(git describe --tags --always) on origin/$branch; re-exec" >/dev/null
        exec bash "$0"
      else
        fail_loud "resync: reset to origin/$branch failed - needs a human on the PC."
      fi ;;
    perf)
      $AM status --as $ME "running perf harness on $TAG" >/dev/null
      if node tools/perf_harness.mjs > "$OUT/perf_run.log" 2>&1; then
        $AM send --from $ME --to dev --tag done \
          "perf done on $TAG: $(cat "$OUT/perf_summary.json" 2>/dev/null | head -c 400). CSV: $OUT/perf.csv"
        # The artifacts themselves, not just a truncated inline blob.
        mail_file "$OUT/perf_summary.json" report >/dev/null || true
        mail_csv "$OUT/perf.csv" >/dev/null || true
      else
        $AM send --from $ME --to dev --tag done \
          "perf FAILED on $TAG — see $OUT/perf_run.log (is playwright installed?)"
      fi ;;
    *)
      $AM send --from $ME --to dev --tag done \
        "job refused (unknown kind): $body — this checkout runs sweep/mirror/factionswap/riverline/map/uniques/pool/skimtrail/pows/convoy/ab/matrix/perf/sendresults/update/resync." ;;
  esac
  # prompt-73: anything new in reports/ goes home automatically - a perf
  # run started by hand on this machine no longer needs a follow-up job.
  local extra
  extra=$(mail_reports)
  [ "${extra:-0}" -gt 0 ] && $AM send --from $ME --to dev --tag done \
    "mailed $extra new report(s) from $TAG" >/dev/null
  $AM status --as $ME "idle on $TAG; waiting for jobs" >/dev/null
}

while true; do
  job=$($AM queue take --as $ME 2>"$OUT/.take_err") || true
  take_err=$(cat "$OUT/.take_err" 2>/dev/null); rm -f "$OUT/.take_err"
  [ -n "$take_err" ] && fail_loud "queue take failed: ${take_err:0:200}"
  if [ -n "$job" ] && ! printf '%s' "$job" | grep -q "queue empty"; then
    log "took a job: $(printf '%s' "$job" | tr '\n' ' ' | cut -c1-160)"
    body=$(printf '%s' "$job" | python3 -c "
import sys, re
text = sys.stdin.read()
m = re.search(r'\{.*\}', text, re.S)
print(m.group(0) if m else '')")
    if [ -n "$body" ]; then
      handle_job "$body"
    else
      # This USED TO BE SILENT: the job was taken off the queue and
      # dropped on the floor with no mail, no log and no error - the
      # queue simply emptied and nothing ever came back.
      fail_loud "job taken but its body did not parse, so it was DISCARDED: $(printf '%s' "$job" | tr '\n' ' ' | cut -c1-200)"
    fi
    continue # drain the queue before waiting
  fi
  [ "${ONCE:-0}" = "1" ] && break
  # Blocking idle loop: returns the moment mail/queue arrives (or timeout).
  log "idle; waiting for work"
  $AM flag wait --as $ME --timeout 3300 >/dev/null 2>&1 || true
done
$AM status --as $ME "worker stopped ($TAG)" >/dev/null
