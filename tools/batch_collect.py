#!/usr/bin/env python3
# tools/batch_collect.py — extract CSV mails (tag "csv", "#file:" header)
# from the LOCAL agent-mail store into reports/sweeps/, then ack them.
# The dev machine hosts the hub, so the store is a local jsonl.
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, ".agent-mail", "messages.jsonl")
OUT = os.path.join(ROOT, "reports", "sweeps")

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
    if m.get("tag") != "csv":
        continue
    body = m.get("body", "")
    if not body.startswith("#file:"):
        continue
    header, _, data = body.partition("\n")
    name = os.path.basename(header[len("#file:"):].strip())
    if not name.endswith(".csv"):
        continue
    path = os.path.join(OUT, name)
    with open(path, "w") as f:
        f.write(data if data.endswith("\n") else data + "\n")
    written.append(name)
    if m.get("hash"):
        hashes.append("@" + m["hash"])
if written:
    print(f"extracted: {', '.join(sorted(set(written)))} -> reports/sweeps/")
    if hashes:
        subprocess.run(
            ["python3", os.path.join(ROOT, "tools", "agent-mail.py"), "ack", *set(hashes), "--as", "dev"],
            capture_output=True)
else:
    print("no csv mails in the store")
