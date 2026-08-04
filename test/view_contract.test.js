// test/view_contract.test.js — W4-4 fallout lint (prompt 174).
//
// THE BUG CLASS: a client gate on a field the view never sends fails
// CLOSED and SILENTLY. `(me?.sandbagsLeft ?? 0) > 0` was false forever
// because buildView didn't project sandbagsLeft — so the sandbag button
// AND its keybind were dead from the day Q50 shipped, with no error, no
// log, and nothing in any unit test to notice. A whole ruled feature was
// reachable only by the AI.
//
// This lint reads the source: every field the client touches on its own
// asset must exist in the per-team view projection. It is deliberately
// crude (regex over source) because the failure it prevents is crude —
// and it costs nothing to keep honest.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function projectedFriendlyFields() {
  const view = readFileSync(new URL("../engine/view.js", import.meta.url), "utf8");
  const start = view.indexOf("const friendlyAssets = state.assets\n    .filter((a) => a.team === team)");
  assert.ok(start > 0, "found the per-team friendly projection (did view.js get restructured?)");
  const block = view.slice(start, view.indexOf("}));", start));
  const fields = new Set([...block.matchAll(/(\w+):/g)].map((m) => m[1]));
  fields.add("id");
  return fields;
}

test("view contract: every own-asset field the client reads is projected", () => {
  const projected = projectedFriendlyFields();
  const client = readFileSync(new URL("../client/js/client.js", import.meta.url), "utf8");
  const used = new Set();
  // The three names the client binds its own asset to.
  for (const v of ["me", "meNow", "myAsset"]) {
    for (const m of client.matchAll(new RegExp(`\\b${v}[?]?\\.(\\w+)`, "g"))) used.add(m[1]);
  }
  const missing = [...used].filter((f) => !projected.has(f) && !f.startsWith("_")).sort();
  assert.deepEqual(
    missing, [],
    `client reads own-asset fields the view never sends: ${missing.join(", ")} — ` +
    "either project them in buildView or stop reading them (a gate on an " +
    "absent field fails closed and silently: that is how the sandbag " +
    "button stayed dead from Q50 until W4-4)"
  );
});

test("view contract: the rack fields the build UI gates on are all present", () => {
  // The specific regression, pinned by name so a refactor cannot quietly
  // drop one again.
  const projected = projectedFriendlyFields();
  for (const field of ["minesLeft", "caltropsLeft", "sandbagsLeft", "campTicks"]) {
    assert.ok(projected.has(field), `${field} must ride the view`);
  }
});
