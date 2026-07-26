#!/usr/bin/env python3
# debugging/analyze_sweep.py — turn BATCH_PC sweep CSVs into findings.
# Usage:
#   python3 debugging/analyze_sweep.py reports/sweeps/sweep.csv
#   python3 debugging/analyze_sweep.py reports/sweeps/sweep.csv reports/sweeps/mirror.csv
# With two files, the second is treated as the MIRRORED run of the first
# (question 18): a bias-free engine flips the winner distribution under
# reflection; residue that survives is directional arithmetic.

import csv
import statistics
import sys

REASONS = {"1": "elimination", "2": "domination", "3": "points-horn", "4": "standard", "0": "undecided"}


def load(path):
    with open(path) as f:
        return list(csv.DictReader(f))


def summarize(rows, label):
    n = len(rows)
    if n == 0:
        print(f"{label}: EMPTY")
        return None
    a = sum(1 for r in rows if r["winner"] == "0")
    b = sum(1 for r in rows if r["winner"] == "1")
    und = n - a - b
    decided = [int(r["ticks"]) for r in rows if r["winner"] in ("0", "1")]
    reasons = {}
    for r in rows:
        key = REASONS.get(r["reason"], r["reason"])
        reasons[key] = reasons.get(key, 0) + 1
    print(f"== {label}: {n} wars ==")
    print(f"  A wins {a} ({100 * a / n:.1f}%)   B wins {b} ({100 * b / n:.1f}%)   undecided {und} ({100 * und / n:.1f}%)")
    if decided:
        print(f"  decided-war length: median {statistics.median(decided):.0f} ticks"
              f" (p10 {sorted(decided)[len(decided) // 10]}, p90 {sorted(decided)[len(decided) * 9 // 10]})")
    print("  outcomes: " + ", ".join(f"{k} {v}" for k, v in sorted(reasons.items(), key=lambda x: -x[1])))
    for col, name in [("tows", "tows"), ("mines", "mines laid"), ("detonations", "detonations"),
                      ("downs", "operators downed"), ("captures", "relay captures"), ("rescued", "rescues")]:
        vals = [int(r[col]) for r in rows]
        print(f"  {name}: mean {statistics.mean(vals):.1f} / war (max {max(vals)})")
    return {"a": a, "b": b, "und": n, "rows": {r["seed"]: r for r in rows}}


def compare_mirror(normal, mirror):
    print("\n== MIRROR ANALYSIS (question 18) ==")
    print("A perfect engine flips outcomes under reflection: A-win seeds should")
    print("become B-win seeds. Residue = directional arithmetic bias.")
    flipped = same = changed_decision = 0
    for seed, r in normal["rows"].items():
        m = mirror["rows"].get(seed)
        if not m:
            continue
        rw, mw = r["winner"], m["winner"]
        if rw in ("0", "1") and mw in ("0", "1"):
            if (rw == "0" and mw == "1") or (rw == "1" and mw == "0"):
                flipped += 1
            else:
                same += 1
        elif rw != mw:
            changed_decision += 1
    total = flipped + same
    print(f"  both-decided pairs: {total} — perfectly flipped {flipped}, SAME winner {same}")
    if total:
        print(f"  flip rate {100 * flipped / total:.1f}% (bias-free target: 100%)")
        if same / total > 0.1:
            print("  VERDICT: significant directional residue — the floor-edge hypothesis has legs.")
        else:
            print("  VERDICT: near-symmetric — remaining winner skew is seed terrain, not direction.")
    print(f"  decision changed by mirroring (decided<->undecided): {changed_decision}")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__ or "usage: analyze_sweep.py <sweep.csv> [mirror.csv]")
    normal = summarize(load(sys.argv[1]), sys.argv[1])
    if len(sys.argv) > 2:
        mirror = summarize(load(sys.argv[2]), sys.argv[2])
        if normal and mirror:
            compare_mirror(normal, mirror)


main()
