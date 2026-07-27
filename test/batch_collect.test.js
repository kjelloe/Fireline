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
    const rows = "seed,winner\n1,0\n2,1";
    writeFileSync(store, [
      JSON.stringify({ tag: "csv", body: `#file:sweep.csv\n${rows}`, hash: "aa" }),
      JSON.stringify({ tag: "csv", body: `#file:../../evil.csv\nx`, hash: "bb" }),
      JSON.stringify({ tag: "csv", body: `#file:notes.txt\nx`, hash: "cc" }),
      JSON.stringify({ tag: "done", body: "sweep done", hash: "dd" }),
      "{corrupt json",
      JSON.stringify({ tag: "csv", body: "no header here" }),
    ].join("\n"));
    const tool = new URL("../tools/batch_collect.py", import.meta.url).pathname;
    const outText = execFileSync("python3", [tool, store, out]).toString();
    assert.match(outText, /sweep\.csv/);
    assert.equal(readFileSync(path.join(out, "sweep.csv"), "utf8"), rows + "\n");
    assert.equal(existsSync(path.join(dir, "evil.csv")), false, "traversal stays inside");
    assert.equal(existsSync(path.join(out, "evil.csv")), true, "basename() defused it");
    assert.equal(existsSync(path.join(out, "notes.txt")), false, "non-csv names refused");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
