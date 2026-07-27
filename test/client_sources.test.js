// test/client_sources.test.js — the guard playtest 5 demanded: every
// client source must PARSE as an ES module. A duplicate import (real
// incident: factionFor declared twice by overlapping patch scripts) is a
// SyntaxError the browser hits at load — and no engine test ever imports
// client.js, so nothing caught it. This does, in milliseconds, no
// browser required.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url).pathname;
const files = [
  ...readdirSync(`${root}client/js`).filter((f) => f.endsWith(".js"))
    .map((f) => `client/js/${f}`),
  "shared/factions.js",
];

test("client sources: every module parses (syntax errors fail HERE, not in the browser)", () => {
  for (const file of files) {
    const source = readFileSync(`${root}${file}`, "utf8");
    try {
      execFileSync(process.execPath, ["--input-type=module", "--check", "-"], {
        input: source, stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      assert.fail(`${file} does not parse: ${err.stderr?.toString().split("\n")[0]}`);
    }
  }
  assert.ok(files.length >= 20, `swept ${files.length} client modules`);
});
