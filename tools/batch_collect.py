#!/usr/bin/env python3
# tools/batch_collect.py — extract RESULT mails ("#file:" header) from the
# LOCAL agent-mail store into reports/sweeps/, then ack them.
# Tags: "csv" (sweep data) and, since prompt-73, "report" — the worker
# now also ships JSON summaries, notably perf_summary.json from the
# native GPU runner. Filtering on the csv tag alone silently dropped
# those on the floor.
# The dev machine hosts the hub, so the store is a local jsonl.
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Overridable for tests: batch_collect.py [store.jsonl] [outdir]
LOG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, ".agent-mail", "messages.jsonl")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "reports", "sweeps")

if not os.path.exists(LOG):
    sys.exit(0)
os.makedirs(OUT, exist_ok=True)
written = []
hashes = []
for line in open(LOG):
    try:
        m = json.loads(line)
    except json.JSONDecodeError:
        continue
    if m.get("tag") not in ("csv", "report"):
        continue
    # the store schema names the payload field "text" (see agent-mail send)
    body = m.get("text", "")
    if not body.startswith("#file:"):
        continue
    header, _, data = body.partition("\n")
    name = os.path.basename(header[len("#file:"):].strip())
    if not name.endswith((".csv", ".json")):
        continue
    path = os.path.join(OUT, name)
    with open(path, "w") as f:
        f.write(data if data.endswith("\n") else data + "\n")
    written.append(name)
    if m.get("id") is not None and len(sys.argv) <= 1:  # never ack a test store
        hashes.append(f"#{m['id']}")  # hashes are derived, never stored; ack by id
if written:
    print(f"extracted: {', '.join(sorted(set(written)))} -> reports/sweeps/")
    if hashes:
        subprocess.run(
            ["python3", os.path.join(ROOT, "tools", "agent-mail.py"), "ack", *set(hashes), "--as", "dev"],
            capture_output=True)
else:
    print("no result mails in the store")
