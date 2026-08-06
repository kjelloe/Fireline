// test/lints.test.js — SOURCE LINTS for the silent-failure classes
// (owner directive, prompt 181: "add more lints before gates").
//
// The failures these catch have one thing in common: NOTHING GOES
// WRONG. No error, no log, no red test. A command is refused before the
// reducer sees it; a string renders as its own key; a feature's button
// never draws. Client smoke and UI acceptance pass the broken build
// happily, because "absent" and "never asked for" look identical at
// run time. Only reading the source catches them.
//
// Each lint here corresponds to a bug that actually shipped.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

// ---------------------------------------------------------------------
// 1. COMMAND COMPLETENESS (the W4-6 bug: deploy_smoke dispatched and
//    handled correctly, and did nothing, because validate() is an
//    ALLOWLIST and refused it before the reducer's switch ran).
// ---------------------------------------------------------------------
test("lint: every command constant has BOTH a validate case and a reducer case", () => {
  const commands = read("../engine/commands.js");
  const reducer = read("../engine/reducer.js");

  const constants = [...commands.matchAll(/export const (CMD_\w+)\s*=/g)].map((m) => m[1]);
  assert.ok(constants.length > 20, `found the command constants (${constants.length})`);

  // validate()'s switch body is everything after "export function validate".
  const validateBody = commands.slice(commands.indexOf("export function validate"));

  const missingValidate = [];
  const missingDispatch = [];
  for (const c of constants) {
    // CMD_CALL_MEDIC is inert by ruling (a social ping with no reducer
    // effect); it is the one deliberate exception.
    if (c === "CMD_CALL_MEDIC") continue;
    if (!new RegExp(`case ${c}\\b`).test(validateBody)) missingValidate.push(c);
    if (!new RegExp(`case ${c}\\b`).test(reducer)) missingDispatch.push(c);
  }
  assert.deepEqual(missingValidate, [],
    `commands with no validate() case — these are SILENT no-ops, refused ` +
    `before the reducer ever runs: ${missingValidate.join(", ")}`);
  assert.deepEqual(missingDispatch, [],
    `commands validated but never dispatched: ${missingDispatch.join(", ")}`);
});

// ---------------------------------------------------------------------
// 2. I18N COMPLETENESS. A missing key renders as the raw key — the
//    player sees "task.raid_prison" in the middle of a war. Total i18n
//    is a stated project value, so a key present in one locale and
//    absent from the other is a bug, not a nicety.
// ---------------------------------------------------------------------
function catalogues() {
  const src = read("../client/js/strings.js");
  // The two catalogue object literals, in file order: en then no.
  const enStart = src.indexOf("en: {");
  const noStart = src.indexOf("no: {");
  assert.ok(enStart > 0 && noStart > enStart, "found both catalogues");
  // NOTE: keys share lines in this catalogue ("a": "x", "b": "y"), so a
  // line-anchored regex silently misses the second one and the lint
  // reports a phantom gap. Match every quoted key followed by a colon.
  const keysIn = (chunk) => new Set([...chunk.matchAll(/"([\w.]+)"\s*:/g)].map((m) => m[1]));
  return { en: keysIn(src.slice(enStart, noStart)), no: keysIn(src.slice(noStart)) };
}

test("lint: every string key exists in BOTH locales", () => {
  const { en, no } = catalogues();
  assert.ok(en.size > 200, `the English catalogue is populated (${en.size})`);
  const missingNo = [...en].filter((k) => !no.has(k)).sort();
  const missingEn = [...no].filter((k) => !en.has(k)).sort();
  assert.deepEqual(missingNo, [], `keys missing from Norsk: ${missingNo.join(", ")}`);
  assert.deepEqual(missingEn, [], `keys missing from English: ${missingEn.join(", ")}`);
});

test("lint: every t(\"...\") the client asks for actually exists", () => {
  const { en } = catalogues();
  const sources = ["../client/js/client.js", "../client/js/tasks_model.js",
    "../client/js/objective_model.js", "../client/js/feedback_model.js"];
  const missing = new Set();
  for (const rel of sources) {
    for (const m of read(rel).matchAll(/\bt\(\s*"([\w.]+)"/g)) {
      if (!en.has(m[1])) missing.add(`${rel.split("/").pop()}:${m[1]}`);
    }
  }
  assert.deepEqual([...missing].sort(), [],
    `t() keys with no catalogue entry — these render as the raw key to ` +
    `the player: ${[...missing].join(", ")}`);
});

// ---------------------------------------------------------------------
// 3. EVENT-NAME REALITY. The client's sound map and feed keys off event
//    type strings. A renamed reducer event silently stops making noise.
// ---------------------------------------------------------------------
test("lint: every event the client's SFX map listens for is one the engine emits", () => {
  const reducer = read("../engine/reducer.js");
  const client = read("../client/js/client.js");
  // Events are NOT always emitted as a `type: "x"` literal — freeSeat()
  // takes the name as an argument, so a literal-only scan reports
  // phantom ghosts. Collect the engine's quoted snake_case vocabulary:
  // deliberately broad, because the failure worth catching is a RENAME,
  // and a renamed event disappears from the sources entirely.
  const emitted = new Set([...reducer.matchAll(/"([a-z][a-z_]+)"/g)].map((m) => m[1]));
  for (const rel of ["../engine/sites.js", "../engine/standards.js", "../engine/prisons.js",
    "../engine/drops.js", "../engine/mission.js", "../engine/bridges.js",
    "../engine/downed.js", "../engine/recovery.js"]) {
    try {
      for (const m of read(rel).matchAll(/"([a-z][a-z_]+)"/g)) emitted.add(m[1]);
    } catch { /* module may not exist */ }
  }
  const mapBody = client.slice(client.indexOf("const SFX_MAP"), client.indexOf("function handleEvents"));
  const listened = [...mapBody.matchAll(/^\s{2}([a-z_]+):/gm)].map((m) => m[1]);
  assert.ok(listened.length > 5, `the SFX map has entries (${listened.length})`);
  const ghosts = listened.filter((k) => !emitted.has(k)).sort();
  assert.deepEqual(ghosts, [],
    `SFX_MAP listens for events the engine never emits (silently mute): ${ghosts.join(", ")}`);
});

// ---------------------------------------------------------------------
// 5. IMPORT REALITY (prompt 202). The stations slice called
//    getUnitStats() at three client.js sites WITHOUT importing it — the
//    whole seat-facing surface (J join, vacant-seat hover tips, the
//    station banner) threw ReferenceError on first touch from the day
//    it shipped, and no gate hovered a friendly hull to notice. This
//    lint: every engine/shared export USED as a bare call in a client
//    module must be imported there or defined locally.
// ---------------------------------------------------------------------
test("lint: client modules import every engine/shared function they call", () => {
  const engineExports = new Set();
  for (const dir of ["../engine", "../shared"]) {
    for (const f of readdirSync(new URL(dir, import.meta.url))) {
      if (!f.endsWith(".js")) continue;
      const src = read(`${dir}/${f}`);
      for (const m of src.matchAll(/export function (\w+)/g)) engineExports.add(m[1]);
    }
  }
  const clientDir = new URL("../client/js", import.meta.url);
  const problems = [];
  for (const f of readdirSync(clientDir)) {
    if (!f.endsWith(".js")) continue;
    const src = read(`../client/js/${f}`);
    const imported = new Set();
    for (const m of src.matchAll(/import\s*\{([^}]+)\}/g)) {
      for (const name of m[1].split(",")) imported.add(name.trim().split(/\s+as\s+/).pop());
    }
    const local = new Set([...src.matchAll(/(?:^|\s)function (\w+)/g)].map((m) => m[1]));
    for (const m of src.matchAll(/\b(\w+)\(/g)) {
      const name = m[1];
      if (!engineExports.has(name) || imported.has(name) || local.has(name)) continue;
      problems.push(`${f}: calls ${name}() without importing it`);
    }
  }
  assert.deepEqual([...new Set(problems)].sort(), [],
    "engine helpers called but never imported (ReferenceError on first " +
    `touch, invisible to every gate that does not exercise the path): ${[...new Set(problems)].join("; ")}`);
});
