#!/bin/bash
# tools/batch_send.sh — queue a job for the BATCH_PC worker lane and (with
# `collect`) read the results back. Dev-machine side of the agent-mail flow.
#
#   bash tools/batch_send.sh sweep 600         # balance census
#   bash tools/batch_send.sh mirror 600        # sides swapped (question 18)
#   bash tools/batch_send.sh matrix 2 100      # hard-AI run
#   bash tools/batch_send.sh map blackwood 300 # per-profile promotion battery
#   bash tools/batch_send.sh pool 350 300      # pacing battery (TICKETPOOL override)
#   bash tools/batch_send.sh resync           # after a REBASE: match upstream exactly
#   bash tools/batch_send.sh perf              # GPU render harness
#   bash tools/batch_send.sh collect           # deliver + settle results
#   bash tools/batch_send.sh board             # who is doing what
set -eu
cd "$(dirname "$0")/.."
AM="python3 tools/agent-mail.py"

case "${1:-}" in
  sweep)  $AM queue add --for batch-pc --as dev --body "{\"kind\":\"sweep\",\"count\":${2:-100}}" ;;
  mirror) $AM queue add --for batch-pc --as dev --body "{\"kind\":\"mirror\",\"count\":${2:-100}}" ;;
  factionswap) $AM queue add --for batch-pc --as dev --body "{\"kind\":\"factionswap\",\"count\":${2:-100}}" ;;
  riverline) $AM queue add --for batch-pc --as dev --body "{\"kind\":\"riverline\",\"count\":${2:-100}}" ;;
  map)    $AM queue add --for batch-pc --as dev --body "{\"kind\":\"map\",\"map\":\"${2:?usage: batch_send.sh map <profile> [count] [mirror] [uniques] [swap]}\",\"count\":${3:-300},\"mirror\":${4:-0},\"uniques\":${5:-0},\"swap\":${6:-0}}" ;;
  uniques) $AM queue add --for batch-pc --as dev --body "{\"kind\":\"uniques\",\"count\":${2:-300},\"swap\":${3:-0},\"mirror\":${4:-0}}" ;;
  pool)   $AM queue add --for batch-pc --as dev --body "{\"kind\":\"pool\",\"ticketPool\":${2:?usage: batch_send.sh pool <ticketPool> [count] [map]},\"count\":${3:-300},\"map\":\"${4:-frontier_corridor}\"}" ;;
  skimtrail) $AM queue add --for batch-pc --as dev --body "{\"kind\":\"skimtrail\",\"speed\":${2:?usage: batch_send.sh skimtrail <speed> [count] [mirror]},\"count\":${3:-300},\"mirror\":${4:-0}}" ;;
  pows)   $AM queue add --for batch-pc --as dev --body "{\"kind\":\"pows\",\"n\":${2:-2},\"count\":${3:-300},\"mirror\":${4:-0}}" ;;
  convoy) $AM queue add --for batch-pc --as dev --body "{\"kind\":\"convoy\",\"attacker\":${2:-0},\"count\":${3:-300}}" ;;
  heist)  $AM queue add --for batch-pc --as dev --body "{\"kind\":\"heist\",\"attacker\":${2:-0},\"count\":${3:-300}}" ;;
  ab)     $AM queue add --for batch-pc --as dev --body "{\"kind\":\"ab\",\"raidparty\":${2:-1},\"powarc\":${3:-1},\"count\":${4:-300},\"label\":\"${5:-ab}\",\"uniques\":${6:-1},\"pows\":\"${7:-}\",\"mirror\":${8:-0}}" ;;
  sendresults) $AM queue add --for batch-pc --as dev --body "{\"kind\":\"sendresults\"}" ;;
  update) $AM queue add --for batch-pc --as dev --body "{\"kind\":\"update\"}" ;;
  resync) $AM queue add --for batch-pc --as dev --body "{\"kind\":\"resync\"}" ;;
  matrix) $AM queue add --for batch-pc --as dev --body "{\"kind\":\"matrix\",\"difficulty\":${2:-2},\"count\":${3:-100}}" ;;
  perf)   $AM queue add --for batch-pc --as dev --body "{\"kind\":\"perf\"}" ;;
  collect) $AM inbox --as dev --tag done --ack; python3 tools/batch_collect.py ;;
  board)  $AM status; $AM queue list ;;
  *) echo "usage: batch_send.sh sweep|mirror|matrix|factionswap|riverline|map|uniques|pool|skimtrail|pows|convoy|perf|update|resync|sendresults|collect|board [args]"; exit 1 ;;
esac
