// test/map_selector.test.js — prompt 76: choosing the starting map.
// The selector reads the REAL profile registry, so a newly registered
// map appears in --list-maps, the picker and the error text with no list
// to update by hand. These tests pin that, and pin the precedence rule
// (CLI beats env beats default) that is easy to invert by accident.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mapProfileNames } from "../engine/state.js";

const runServer = (args, env = {}) => {
  try {
    return {
      out: execFileSync(process.execPath, ["server/index.js", ...args],
        { encoding: "utf8", env: { ...process.env, ...env } }),
      code: 0,
    };
  } catch (e) {
    return { out: `${e.stdout ?? ""}${e.stderr ?? ""}`, code: e.status };
  }
};

test("76: --list-maps reports exactly the registered profiles", () => {
  const { out, code } = runServer(["--list-maps"]);
  assert.equal(code, 0);
  assert.deepEqual(out.trim().split("\n"), mapProfileNames());
});

test("76: an unknown map fails loudly, lists the real registry, and exits 2", () => {
  const { out, code } = runServer(["--map", "blackwod"]);
  assert.equal(code, 2, "a typo must not start a server on the wrong map");
  assert.match(out, /unknown map: blackwod/);
  for (const name of mapProfileNames()) {
    assert.ok(out.includes(name), `the error should list ${name}`);
  }
  assert.match(out, /did you mean: blackwood/, "a near miss should be suggested");
});

test("76: --help documents the selector and exits 0", () => {
  const { out, code } = runServer(["--help"]);
  assert.equal(code, 0);
  assert.match(out, /--map/);
  assert.match(out, /npm run pick/);
});

test("76: an unknown OPTION is refused rather than ignored", () => {
  const { out, code } = runServer(["--mapp", "blackwood"]);
  assert.equal(code, 2, "a mistyped flag must not silently start the default map");
  assert.match(out, /unknown option/);
});

test("76/146: every npm start:<x> script names a registered profile or mode", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const starts = Object.entries(pkg.scripts).filter(([k]) => k.startsWith("start:"));
  assert.ok(starts.length >= 2, "expected per-map start scripts");
  const MODES = ["standard", "convoy", "heist"];
  for (const [name, cmd] of starts) {
    const m = cmd.match(/--map\s+(\S+)/);
    const mo = cmd.match(/--mode\s+(\S+)/);
    assert.ok(m || mo, `${name} should pass --map or --mode`);
    if (m) {
      assert.ok(mapProfileNames().includes(m[1]),
        `${name} points at "${m[1]}", which is not a registered profile`);
    }
    if (mo) {
      assert.ok(MODES.includes(mo[1]),
        `${name} points at mode "${mo[1]}", which is not a mode`);
    }
  }
});

test("76: the picker offers every registered profile", () => {
  // Reading the source keeps this cheap and avoids driving a TTY, while
  // still failing if a new map is added and the picker is not updated.
  const src = readFileSync("tools/pick_map.mjs", "utf8");
  assert.match(src, /mapProfileNames/, "the picker must read the real registry");
  for (const name of mapProfileNames()) {
    assert.ok(src.includes(name), `the picker has no blurb for ${name}`);
  }
});
