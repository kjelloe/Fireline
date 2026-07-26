// client/js/replay.js — Slice 11H: replay viewer UI. Top-down 2D canvas —
// deliberately map-like: this viewer exists for balance study, where the
// bird's-eye read beats the 3D presentation. Local re-simulation via
// replay_engine; play/pause, ×1/×4/×16, scrub, jump.

import { createReplayPlayer } from "./replay_engine.js";
import { describeEvent } from "./feedback_model.js";

const TERRAIN_COLORS = ["#3e5a3e", "#8a8a72", "#274427", "#5e5240", "#2b2b33", "#6e5f42", "#2a4a66"]; // 11N path, 12C water
const TEAM_COLORS = ["#57c46b", "#d05a4a"];
const CELL_PX = 6; // 128 cells -> 768 px
const WIN_REASONS = { 1: "elimination", 2: "domination", 3: "points horn", 4: "STANDARD CAPTURED" };

const qs = new URLSearchParams(location.search);
const warId = qs.get("id");

if (!warId) showList();
else showViewer(warId);

async function showList() {
  const el = document.getElementById("war-list");
  el.style.display = "block";
  const { replays } = await (await fetch("/replays")).json();
  if (!replays.length) {
    el.innerHTML = "<p>No archived wars yet — finish one first.</p>";
    return;
  }
  el.innerHTML = "<table><tr><th>war</th><th>seed</th><th>ticks</th>" +
    "<th>winner</th><th>reason</th><th>finished</th></tr>" +
    replays.slice().reverse().map((r) =>
      `<tr><td><a href="?id=${encodeURIComponent(r.id)}">${r.id}</a></td>` +
      `<td>${r.mapSeed}</td><td>${r.ticks}</td>` +
      `<td>${r.winner === -1 ? "draw" : "team " + (r.winner === 0 ? "A" : "B")}</td>` +
      `<td>${WIN_REASONS[r.reason] ?? r.reason}</td>` +
      `<td>${r.finishedAt ?? ""}</td></tr>`).join("") + "</table>";
}

async function showViewer(id) {
  const record = await (await fetch(`/replay/${encodeURIComponent(id)}`)).json();
  for (const el of ["stage", "controls", "feed"]) {
    document.getElementById(el).style.display = el === "stage" ? "flex" : "flex";
  }
  document.getElementById("meta").textContent =
    `${id} — seed ${record.meta.mapSeed}, ${record.meta.ticks} ticks, ` +
    `${record.meta.winner === -1 ? "draw" : "team " + (record.meta.winner === 0 ? "A" : "B")} ` +
    `by ${WIN_REASONS[record.meta.reason] ?? record.meta.reason}`;

  const player = createReplayPlayer(record);
  const scrub = document.getElementById("scrub");
  scrub.max = player.lastTick();
  const ctx = document.getElementById("board").getContext("2d");
  const feed = document.getElementById("feed");
  const feedLines = [];

  let playing = false;
  let speed = 4;
  let tick = 0;

  const btnPlay = document.getElementById("btn-play");
  btnPlay.onclick = () => { playing = !playing; btnPlay.textContent = playing ? "Pause" : "Play"; };
  for (const b of document.querySelectorAll(".speed")) {
    b.onclick = () => {
      speed = Number(b.dataset.x);
      document.querySelectorAll(".speed").forEach((x) => x.classList.toggle("active", x === b));
    };
  }
  document.querySelector('.speed[data-x="4"]').classList.add("active");
  scrub.oninput = () => { tick = Number(scrub.value); feedLines.length = 0; };
  window.addEventListener("keydown", (e) => {
    if (e.key === " ") { e.preventDefault(); btnPlay.onclick(); }
    if (e.key === "ArrowRight") tick = Math.min(player.lastTick(), tick + 100);
    if (e.key === "ArrowLeft") tick = Math.max(0, tick - 100);
  });

  let last = performance.now();
  function frame(now) {
    // 10 sim-ticks per second at x1.
    if (playing) tick = Math.min(player.lastTick(), tick + ((now - last) / 100) * speed);
    last = now;
    const state = player.seek(Math.floor(tick));
    for (const e of state.events) {
      const line = describeEvent(e, 0);
      if (line && ["site_captured", "site_neutralized", "standard_taken", "standard_returned",
                   "standard_scored", "asset_disabled", "mine_detonated", "drone_launched",
                   "site_damaged", "site_repaired", "game_over"].includes(e.type)) {
        feedLines.push(`[${state.tick}] ${line}`);
      }
    }
    while (feedLines.length > 3) feedLines.shift();
    feed.innerHTML = feedLines.join("<br>");
    draw(ctx, state);
    scrub.value = state.tick;
    document.getElementById("tick-label").textContent =
      `tick ${state.tick} — A ${state.teamScores[0]} : ${state.teamScores[1]} B` +
      (state.phase === 1 ? " — WAR OVER" : "");
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function draw(ctx, state) {
  const { width, height, cells } = state.map;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      ctx.fillStyle = TERRAIN_COLORS[cells[y * width + x]] ?? "#222";
      ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
    }
  }
  for (const b of state.bases) {
    ctx.strokeStyle = TEAM_COLORS[b.team];
    ctx.strokeRect(b.x * CELL_PX, b.y * CELL_PX, b.width * CELL_PX, b.height * CELL_PX);
  }
  for (const s of state.sites) {
    ctx.fillStyle = s.hp === 0 ? "#3a3028" : (s.owner === -1 ? "#888" : TEAM_COLORS[s.owner]);
    ctx.fillRect(s.cellX * CELL_PX - 3, s.cellY * CELL_PX - 3, CELL_PX + 6, CELL_PX + 6);
    if (s.captureProgress > 0) {
      ctx.fillStyle = "#f5e96b";
      ctx.fillRect(s.cellX * CELL_PX - 3, s.cellY * CELL_PX - 6,
        (CELL_PX + 6) * Math.min(1, s.captureProgress / 30), 2);
    }
  }
  for (const m of state.mines) {
    ctx.fillStyle = m.marked ? "#d03a2a" : "#222";
    ctx.beginPath();
    ctx.arc(m.cellX * CELL_PX + 3, m.cellY * CELL_PX + 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const a of state.assets) {
    const x = (a.x / 256) * CELL_PX;
    const y = (a.y / 256) * CELL_PX;
    if (a.state === 2 || a.state === 3) {
      ctx.strokeStyle = "#555";
      ctx.strokeRect(x - 2, y - 2, 5, 5);
      continue;
    }
    ctx.fillStyle = TEAM_COLORS[a.team];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((a.heading / 256) * Math.PI * 2);
    ctx.fillRect(-3, -3, 7, 7);
    ctx.fillRect(2, -1, 5, 2); // barrel shows facing
    ctx.restore();
    if (a.operatorId !== -1 && a.operatorId < 16) { // human-crewed marker
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(x - 5, y - 5, 10, 10);
    }
  }
  for (const d of state.downed) {
    ctx.fillStyle = "#ffd75e";
    ctx.fillRect((d.x / 256) * CELL_PX - 1, (d.y / 256) * CELL_PX - 1, 3, 3);
  }
  for (const d of state.drones) {
    const x = (d.x / 256) * CELL_PX;
    const y = (d.y / 256) * CELL_PX;
    ctx.strokeStyle = "#ccc";
    ctx.beginPath();
    ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y);
    ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
    ctx.stroke();
  }
  for (const st of state.standards) {
    ctx.fillStyle = st.status === 1 || st.status === 2 ? "#ffdd00" : "#c9a227";
    ctx.beginPath();
    ctx.arc((st.x / 256) * CELL_PX, (st.y / 256) * CELL_PX, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
