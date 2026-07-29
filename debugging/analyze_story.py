#!/usr/bin/env python3
# debugging/analyze_story.py — the story-metric summary (prompt 88).
# Answers the designer's actual question about a pacing change: "did the
# extra minutes create stories, or just delay the result?"
#
#   python3 debugging/analyze_story.py reports/sweeps/sweep.csv [more.csv...]
import csv, statistics, sys

def pct(xs, p):
    xs = sorted(xs)
    if not xs: return 0
    k = (len(xs) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)

REASON = {"3": "horn", "4": "standard", "5": "tickets", "1": "domination", "2": "elimination"}

for path in sys.argv[1:]:
    with open(path) as f:
        rows = list(csv.DictReader(f))
    if not rows:
        print(f"{path}: empty"); continue
    n = len(rows)
    ticks = [int(r["ticks"]) for r in rows]
    decided = [r for r in rows if r["winner"] in ("0", "1")]
    reasons = {}
    for r in decided:
        key = REASON.get(r["reason"], r["reason"])
        reasons[key] = reasons.get(key, 0) + 1
    has_story = "leadChanges" in rows[0]
    print(f"\n== {path} ({n} wars) ==")
    m = statistics.median(ticks)
    print(f"length     median {m:.0f} ticks ({m/600:.1f} min) | q25 {pct(ticks,.25):.0f} q75 {pct(ticks,.75):.0f}")
    print(f"endings    " + " ".join(f"{k} {v*100/n:.0f}%" for k, v in sorted(reasons.items()))
          + f" | undecided {(n-len(decided))*100/n:.0f}%")
    if not has_story:
        print("           (no story columns — pre-prompt-88 CSV)"); continue
    lead = [int(r["leadChanges"]) for r in rows]
    flips = [int(r["majorityFlips"]) for r in rows]
    defs = [int(r["winnerMaxDeficit"]) for r in decided if int(r["winnerMaxDeficit"]) >= 0]
    # comeback = the winner was at some point at least 20% of a pool behind
    pool_guess = max((int(r["winnerMargin"]) for r in decided), default=300)
    comeback_bar = max(30, pool_guess // 5)
    comebacks = sum(1 for d in defs if d >= comeback_bar)
    print(f"stories    lead changes mean {statistics.mean(lead):.1f} | majority flips mean {statistics.mean(flips):.1f}")
    print(f"comebacks  {comebacks*100/max(1,len(defs)):.0f}% of decided wars the winner was ≥{comeback_bar} tickets behind")
    print(f"standard   attempts/war {statistics.mean([int(r['stdAttempts']) for r in rows]):.1f}"
          f" | scored {sum(int(r['stdScored']) for r in rows)} total")
    print(f"systems    field repairs/war {statistics.mean([int(r['fieldRepairs']) for r in rows]):.1f}"
          f" | mercy engaged in {sum(1 for r in rows if int(r['mercyBleeds'])>0)*100/n:.0f}%"
          f" | overtime in {sum(1 for r in rows if int(r['overtimeTicks'])>0)*100/n:.0f}%")
