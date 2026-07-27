// test/client_wiring.test.js — two regression nets from real incidents:
// 1. Every DOM id client.js asks for must exist in index.html (a missing
//    id wires to null SILENTLY — settings/banners just stop working).
// 2. Every literal t("key") in client sources must exist in the en
//    catalog (a typo'd key renders as the raw key string in the HUD).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url).pathname;

test("component: every getElementById target exists in index.html", () => {
  const html = readFileSync(`${root}client/index.html`, "utf8");
  const client = readFileSync(`${root}client/js/client.js`, "utf8");
  const ids = [...client.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(ids.length >= 15, `swept ${ids.length} DOM lookups`);
  for (const id of new Set(ids)) {
    assert.ok(html.includes(`id="${id}"`), `index.html is missing id="${id}"`);
  }
});

test("component: every literal t(\"key\") resolves in the en catalog", async () => {
  const { CATALOGS } = await import("../client/js/strings.js");
  const files = readdirSync(`${root}client/js`).filter((f) => f.endsWith(".js"));
  let swept = 0;
  for (const f of files) {
    const src = readFileSync(`${root}client/js/${f}`, "utf8");
    for (const m of src.matchAll(/\bt\("([^"]+)"/g)) {
      swept += 1;
      assert.ok(m[1] in CATALOGS.en, `${f}: t("${m[1]}") has no catalog entry`);
    }
  }
  assert.ok(swept >= 60, `swept ${swept} t() call sites`);
});
