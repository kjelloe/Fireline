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

REASONS = {"1": "elimination", "2": "domination", "3": "points-horn", "4": "standard", "5": "tickets", "0": "undecided"}


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
        print(f"  flip rate {100 * flipped / total:.1f}%")
        # Post-16a reading (tick-parity landed): the per-seed flip rate only
        # says how CORRELATED the mirrored war is with the original. What
        # indicts a team bias is the AGGREGATE: the same team keeping its
        # edge in both worlds. ~50% flip + ~50/50 aggregates = fair chaos.
        a_all = normal["a"] + mirror["a"]
        b_all = normal["b"] + mirror["b"]
        decided = a_all + b_all
        a_pct = 100 * a_all / decided if decided else 0
        print(f"  aggregate across both worlds: A {a_all} / B {b_all} ({a_pct:.1f}% A of decided)")
        if abs(a_pct - 50) > 4:
            print("  VERDICT: TEAM BIAS — the same team keeps its edge regardless of side.")
        elif flipped / total > 0.9:
            print("  VERDICT: near-perfect flip — outcomes follow geometry; engine is side-sensitive but team-fair.")
        else:
            print("  VERDICT: decorrelated + balanced aggregates — no team bias; mirror pairs diverge as fair chaos.")
    print(f"  decision changed by mirroring (decided<->undecided): {changed_decision}")


def compare_factions(normal, swap):
    # 12D: with uniques traded (Sentinel<->Skimmer), a fair pair keeps win
    # rates steady; a shift that TRACKS the swap is chassis imbalance.
    print("\n== FACTION-SWAP ANALYSIS (12D gate) ==")
    n = normal["a"] + normal["b"]
    s = swap["a"] + swap["b"]
    if not n or not s:
        print("  not enough decided wars to judge")
        return
    a_norm = normal["a"] / n
    a_swap = swap["a"] / s
    # Sentinel sits WEST (team A) normally, EAST after the swap.
    sentinel_rate = (normal["a"] + swap["b"]) / (n + s)
    print(f"  team A win rate: normal {100*a_norm:.1f}%  swapped {100*a_swap:.1f}%")
    print(f"  SENTINEL-side win rate across both runs: {100*sentinel_rate:.1f}%")
    if abs(sentinel_rate - 0.5) > 0.08:
        who = "Sentinel" if sentinel_rate > 0.5 else "Skimmer"
        print(f"  VERDICT: the {who} side over-performs — the unique pair needs tuning.")
    else:
        print("  VERDICT: unique pair within band — side/seed effects dominate.")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__ or "usage: analyze_sweep.py <sweep.csv> [mirror.csv] [--factionswap swap.csv]")
    if "--factionswap" in sys.argv:
        i = sys.argv.index("--factionswap")
        normal = summarize(load(sys.argv[1]), sys.argv[1])
        swap = summarize(load(sys.argv[i + 1]), sys.argv[i + 1])
        if normal and swap:
            compare_factions(normal, swap)
        return
    normal = summarize(load(sys.argv[1]), sys.argv[1])
    if len(sys.argv) > 2:
        mirror = summarize(load(sys.argv[2]), sys.argv[2])
        if normal and mirror:
            compare_mirror(normal, mirror)


main()
