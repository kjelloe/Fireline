#!/bin/bash
# Wave-1 close-out sim campaign: AI-only standard wars across seeds, with
# the drone/MPG/mine systems live. Summarizes outcomes + new-system events.
for SEED in 2026 777 31337 4242 9001; do
  echo "===== seed $SEED ====="
  SEED=$SEED TICKS=16000 npm run simwar 2>/dev/null \
    | grep -E "^(winner|standards|seed)|game_over|standard_scored" \
    | tail -6
done
