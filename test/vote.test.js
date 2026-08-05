// test/vote.test.js — Q49 (ruled): map+mode pair voting. Votes are a
// TRANSPORT concern (opinions, not gameplay state — nothing hashed);
// the pump applies the plurality pick at war reset. Ws-level per the
// every-new-command-needs-one-wire-test rule.

import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer, WebSocket } from "ws";
import { GameServer } from "../engine/server.js";
import { NetworkTransport } from "../engine/transport.js";
import { MISSION_CONVOY } from "../engine/mission.js";

const until = async (fn, ms = 3000) => {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error("poll timeout");
    await new Promise((r) => setTimeout(r, 10));
  }
};

function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const got = [];
  ws.on("message", (raw) => got.push(JSON.parse(raw)));
  return { ws, got, find: (type) => got.find((m) => m.type === type) };
}

test("Q49: vote opens over the wire, plurality pick applies at reset", async () => {
  const server = new GameServer({ mapSeed: 42 });
  const wss = new WebSocketServer({ port: 0 });
  const transport = new NetworkTransport(server, wss);
  const port = wss.address().port;
  try {
    const a = client(port);
    const b = client(port);
    await until(() => a.ws.readyState === 1 && b.ws.readyState === 1);
    a.ws.send(JSON.stringify({ type: "c_join", team: 0 }));
    b.ws.send(JSON.stringify({ type: "c_join", team: 1 }));
    await until(() => a.find("s_joined") && b.find("s_joined"));

    const candidates = [
      { map: "frontier_corridor", mode: 0 },
      { map: "blackwood", mode: 0 },
      { map: "frontier_corridor", mode: 1, modeAttacker: 1 },
    ];
    transport.openVote(candidates);
    await until(() => a.find("s_vote_open") && b.find("s_vote_open"));
    assert.equal(a.find("s_vote_open").candidates.length, 3);

    a.ws.send(JSON.stringify({ type: "c_vote", choice: 2 }));
    b.ws.send(JSON.stringify({ type: "c_vote", choice: 2 }));
    await until(() => a.find("s_vote_ack") && b.find("s_vote_ack"));

    const verdict = transport.tallyVote();
    assert.equal(verdict.winner, 2);
    assert.deepEqual(verdict.counts, [0, 0, 2]);

    // The pick drives the reset: same seed law, new map/mode law.
    const pick = verdict.pick;
    server.resetWar(1234, {
      mapProfile: pick.map,
      modeRules: pick.mode === 1 ? { mode: 1, modeAttacker: pick.modeAttacker ?? 0 } : null,
    });
    assert.equal(server.state.mission?.kind, MISSION_CONVOY, "the voted convoy war");
    assert.equal(server.state.mission.attacker, 1);
    assert.equal(server.state.standards.length, 0);

    // Voting a STANDARD pair afterwards strips the mode again.
    server.resetWar(1235, { mapProfile: "blackwood", modeRules: null });
    assert.equal(server.state.mission, null, "back to a standard war");
    assert.equal(server.state.mapProfile, "blackwood");
  } finally {
    for (const c of wss.clients) c.terminate();
    wss.close();
  }
});

test("Q49: silence keeps the status quo; spectators cannot vote", async () => {
  const server = new GameServer({ mapSeed: 42 });
  const wss = new WebSocketServer({ port: 0 });
  const transport = new NetworkTransport(server, wss);
  const port = wss.address().port;
  try {
    const spec = client(port);
    await until(() => spec.ws.readyState === 1);
    spec.ws.send(JSON.stringify({ type: "c_spectate" }));
    await until(() => spec.find("s_spectating"));
    transport.openVote([{ map: "frontier_corridor", mode: 0 }, { map: "blackwood", mode: 0 }]);
    await until(() => spec.find("s_vote_open"));
    spec.ws.send(JSON.stringify({ type: "c_vote", choice: 1 }));
    await new Promise((r) => setTimeout(r, 100));
    const verdict = transport.tallyVote();
    assert.equal(verdict.winner, 0, "no valid votes: index 0 (status quo) stands");
    assert.deepEqual(verdict.counts, [0, 0]);
  } finally {
    for (const c of wss.clients) c.terminate();
    wss.close();
  }
});

// ── Q54: the configurable rotation pool ──────────────────────────────
test("Q54: pool defaults, filtering, and candidate law", async () => {
  const { normalizePool, voteCandidates, COMPLETED_MAPS } = await import("../engine/vote.js");
  // Defaults: every completed map, every mode.
  // W4-10: "night" joined ALL_MODES as a VARIANT (it rides the running
  // war rather than replacing it), so the default pool now offers it.
  assert.deepEqual(normalizePool({}), { maps: COMPLETED_MAPS, modes: ["standard", "convoy", "heist", "night"] });
  // Unknown maps filtered against the valid list; empty result falls back.
  assert.deepEqual(
    normalizePool({ maps: ["blackwood", "atlantis"] }, ["frontier_corridor", "blackwood"]).maps,
    ["blackwood"]);
  assert.deepEqual(normalizePool({ maps: ["atlantis"] }, ["blackwood"]).maps, COMPLETED_MAPS);
  // Modes: unknown entries dropped; empty = standard only.
  assert.deepEqual(normalizePool({ modes: ["convoy", "heist"] }).modes, ["convoy", "heist"],
    "heist is a real mode since Q52");
  assert.deepEqual(normalizePool({ modes: ["convoy", "atlantis_mode"] }).modes, ["convoy"]);
  assert.deepEqual(normalizePool({ modes: ["heist"] }).modes, ["heist"], "a heist-only server is legal since Q52");
  assert.deepEqual(normalizePool({ modes: ["atlantis_mode"] }).modes, ["standard"], "all-invalid falls back to standard");

  const state = { mapProfile: "frontier_corridor", rules: {} };
  // Full pool: status quo, rotation, convoy flip.
  const full = voteCandidates(state, 3, normalizePool({}));
  assert.equal(full.length, 3);
  assert.deepEqual(full[0], { map: "frontier_corridor", mode: 0, modeAttacker: 0 });
  assert.equal(full[1].map, "blackwood");
  // W4-10: the third slot now rotates convoy / heist / NIGHT by war
  // count, so the ballot stays three choices (the Q54 law + the UI).
  // flips[3 % 3] = convoy, then heist, then night — a fair share each.
  assert.deepEqual(full[2], { map: "frontier_corridor", mode: 1, modeAttacker: 1 });
  assert.equal(voteCandidates(state, 4, normalizePool({}))[2].mode, 2, "then heist");
  const w5 = voteCandidates(state, 5, normalizePool({}))[2];
  assert.equal(w5.night, true, "then a night war");
  assert.equal(voteCandidates(state, 5, normalizePool({})).length, 3, "always three choices");
  // Convoy disabled: no mode flip offered.
  const noConvoy = voteCandidates(state, 3, normalizePool({ modes: ["standard"] }));
  assert.equal(noConvoy.length, 2);
  assert.ok(noConvoy.every((c) => c.mode === 0));
  // One-map pool: no rotation candidate.
  const oneMap = voteCandidates(state, 3,
    normalizePool({ maps: ["frontier_corridor"] }, ["frontier_corridor"]));
  assert.ok(oneMap.every((c) => c.map === "frontier_corridor"));
  // A running convoy server always gets the way BACK to standard.
  const convoyState = { mapProfile: "blackwood", rules: { mode: 1, modeAttacker: 1 } };
  const back = voteCandidates(convoyState, 4, normalizePool({ modes: ["standard"] }));
  assert.deepEqual(back[0], { map: "blackwood", mode: 1, modeAttacker: 1 }, "status quo first");
  assert.ok(back.some((c) => c.map === "blackwood" && c.mode === 0), "the exit exists");
});

test("W4-10 (Q80): NIGHT rides the ballot as a variant of the current war", async () => {
  const { voteCandidates, normalizePool } = await import("../engine/vote.js");
  const day = { mapProfile: "blackwood", rules: { mode: 0 } };
  const cands = voteCandidates(day, 2, normalizePool({ maps: ["blackwood"], modes: ["standard", "night"] }));
  const night = cands.find((c) => c.night);
  assert.ok(night, "the ballot offers a night war");
  assert.equal(night.map, "blackwood", "on the SAME map — it is a variant, not a rotation");
  assert.equal(night.mode, 0, "and the same mode");

  // Already at night? Then it is not on the ballot — never offer what
  // you are already playing.
  const atNight = { mapProfile: "blackwood", rules: { mode: 0, nightWar: true } };
  const again = voteCandidates(atNight, 2, normalizePool({ maps: ["blackwood"], modes: ["standard", "night"] }));
  assert.equal(again.find((c) => c.night), undefined);

  // A pool without night never offers it.
  const noNight = voteCandidates(day, 2, normalizePool({ maps: ["blackwood"], modes: ["standard"] }));
  assert.equal(noNight.find((c) => c.night), undefined);
});
