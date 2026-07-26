#!/bin/bash
# tools/batch_send.sh — queue a job for the BATCH_PC worker lane and (with
# `collect`) read the results back. Dev-machine side of the agent-mail flow.
#
#   bash tools/batch_send.sh sweep 600         # balance census
#   bash tools/batch_send.sh mirror 600        # sides swapped (question 18)
#   bash tools/batch_send.sh matrix 2 100      # hard-AI run
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
  matrix) $AM queue add --for batch-pc --as dev --body "{\"kind\":\"matrix\",\"difficulty\":${2:-2},\"count\":${3:-100}}" ;;
  perf)   $AM queue add --for batch-pc --as dev --body "{\"kind\":\"perf\"}" ;;
  collect) $AM inbox --as dev --tag done --ack ;;
  board)  $AM status; $AM queue list ;;
  *) echo "usage: batch_send.sh sweep|mirror|matrix|factionswap|perf|collect|board [args]"; exit 1 ;;
esac
