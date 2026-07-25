// test/milestone4e.test.js — Milestone 4E: deployment readiness.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAppServer } from "../server/index.js";

test("4E health endpoint carries load-balancer fields", async () => {
  const appServer = createAppServer({ mapSeed: 1, enableAi: false, version: "test" });
  const addr = await appServer.start(0, { setIntervalFn: () => 0, clearIntervalFn: () => {} });
  try {
    appServer.gameServer.step();
    const body = await (await fetch(`http://localhost:${addr.port}/health`)).json();
    assert.equal(body.status, "ok");
    assert.equal(body.tick, 1);
    assert.equal(body.phase, 0);
    assert.equal(body.players, 0);
    assert.equal(body.version, "test");
    assert.equal(typeof body.uptimeMs, "number");
  } finally {
    await appServer.stop();
  }
});

test("4E Dockerfile ships only runtime layers and a healthcheck", () => {
  const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.match(dockerfile, /npm ci --omit=dev/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /CMD \["node", "server\/index.js"\]/);
  const ignore = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8");
  assert.match(ignore, /node_modules/);
  assert.match(ignore, /phases/);
});
