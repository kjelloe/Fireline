// test/batch_collect.test.js — the CSV-over-mail extractor (prompt 41).
// The parsing is the fragile part: #file headers, path traversal
// attempts, corrupt jsonl lines, non-csv names — all must behave.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("batch_collect extracts csv mails, ignores junk, defuses traversal", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mf-collect-"));
  try {
    const store = path.join(dir, "messages.jsonl");
    const out = path.join(dir, "sweeps");
    // Fixtures use the REAL store schema: the payload field is "text" (the
    // first version of this test invented a "body" field and passed while
    // the tool failed on real mail — the fixture below is copied VERBATIM
    // from a live store line so the schema cannot drift silently again).
    const rows = "seed,winner\n1,0\n2,1";
    const verbatim =
      '{"id": 14, "ts": 1785144292, "from": "probe", "to": "probe-sink", "text": "#file:probe2.csv\\na,b\\n3,4", "tag": "csv"}';
    writeFileSync(store, [
      verbatim,
      JSON.stringify({ id: 15, from: "batch-pc", to: "dev", text: `#file:sweep.csv\n${rows}`, tag: "csv" }),
      JSON.stringify({ id: 16, from: "batch-pc", to: "dev", text: `#file:../../evil.csv\nx`, tag: "csv" }),
      JSON.stringify({ id: 17, from: "batch-pc", to: "dev", text: `#file:notes.txt\nx`, tag: "csv" }),
      JSON.stringify({ id: 18, from: "batch-pc", to: "dev", text: "sweep done", tag: "done" }),
      "{corrupt json",
      JSON.stringify({ id: 19, from: "batch-pc", to: "dev", text: "no header here", tag: "csv" }),
    ].join("\n"));
    const tool = new URL("../tools/batch_collect.py", import.meta.url).pathname;
    const outText = execFileSync("python3", [tool, store, out]).toString();
    assert.match(outText, /sweep\.csv/);
    assert.equal(readFileSync(path.join(out, "probe2.csv"), "utf8"), "a,b\n3,4\n", "verbatim live-store line extracts");
    assert.equal(readFileSync(path.join(out, "sweep.csv"), "utf8"), rows + "\n");
    assert.equal(existsSync(path.join(dir, "evil.csv")), false, "traversal stays inside");
    assert.equal(existsSync(path.join(out, "evil.csv")), true, "basename() defused it");
    assert.equal(existsSync(path.join(out, "notes.txt")), false, "non-csv names refused");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("batch_collect shelves a differing result as .prev instead of clobbering it", () => {
  // A re-run battery reuses its label; the old result is a comparator,
  // not garbage. (The blackwood before-CSV died this way.)
  const dir = mkdtempSync(path.join(tmpdir(), "mf-collect-"));
  try {
    const store = path.join(dir, "messages.jsonl");
    const out = path.join(dir, "sweeps");
    const tool = new URL("../tools/batch_collect.py", import.meta.url).pathname;
    writeFileSync(store, JSON.stringify(
      { id: 1, from: "batch-pc", to: "dev", text: "#file:map_x.csv\nseed,winner\n1,0", tag: "csv" }));
    execFileSync("python3", [tool, store, out]);
    writeFileSync(store, JSON.stringify(
      { id: 2, from: "batch-pc", to: "dev", text: "#file:map_x.csv\nseed,winner\n1,1", tag: "csv" }));
    execFileSync("python3", [tool, store, out]);
    assert.equal(readFileSync(path.join(out, "map_x.csv"), "utf8"), "seed,winner\n1,1\n", "newest wins the name");
    assert.equal(readFileSync(path.join(out, "map_x.csv.prev"), "utf8"), "seed,winner\n1,0\n", "old result shelved");
    // Same content again: no shelving churn.
    execFileSync("python3", [tool, store, out]);
    assert.equal(readFileSync(path.join(out, "map_x.csv.prev"), "utf8"), "seed,winner\n1,0\n", "identical re-collect keeps the shelf");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
