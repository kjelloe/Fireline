// test/powershell_ascii.test.js — a guard for a trap that is invisible
// on Linux and fatal on Windows.
//
// PowerShell 5.1 (still the default shell on Windows 10/11) reads a
// BOM-less script as Windows-1252, NOT UTF-8. A single em dash inside a
// double-quoted string decodes to three characters ending in a quote,
// which TERMINATES the string early — the file then fails to parse with
// errors pointing at innocent words several lines away. This bit
// tools/perf_native.ps1 the moment it first ran.
//
// Keeping .ps1 sources pure ASCII sidesteps the encoding question
// entirely, and works on every PowerShell version.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TOOLS = "tools";

test("PowerShell scripts are pure ASCII (Windows-1252 decoding trap)", () => {
  const scripts = readdirSync(TOOLS).filter((f) => f.endsWith(".ps1"));
  assert.ok(scripts.length > 0, "expected at least one .ps1 in tools/");
  for (const file of scripts) {
    const text = readFileSync(join(TOOLS, file), "utf8");
    const offenders = [];
    text.split("\n").forEach((line, i) => {
      for (const ch of line) {
        if (ch.codePointAt(0) > 126) {
          offenders.push(`${file}:${i + 1} U+${ch.codePointAt(0).toString(16).toUpperCase()} (${ch})`);
          break;
        }
      }
    });
    assert.deepEqual(offenders, [],
      `non-ASCII in a .ps1 will mis-decode under PowerShell 5.1 — use plain ASCII:\n  ${offenders.join("\n  ")}`);
  }
});
