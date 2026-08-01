// client/js/client.js — browser presentation adapter (slice 2F).
// Renders fog-filtered server views with three.js, interpolates 10Hz
// snapshots, and translates clicks into commands. No game logic here:
// every outcome comes back from the server.

import * as THREE from "three";
import { createInterpolator } from "./interpolator.js";
import { scenePointToCell, buildCommandForClick, buildSelectCommand } from "./input_mapper.js";
import { diffVisibleEnemies, visibleEnemyIds } from "./fog_culler.js";
import { supplyOverlays, weaponRangeOverlay, healthBars } from "./overlay_model.js";
import { mapEventsToCues } from "./audio_cues.js";
import { mapEventsToVfx, pruneVfx, vfxAge } from "./vfx_cues.js";
import {
  mapEventsToMotion, recoilKick, tracerPoint, dustStep, motionAge, pruneMotion,
  MOTION_TTL_MS,
} from "./motion_cues.js";
import { createSpriteRenderer } from "./sprite_renderer.js";
import { rowsFor } from "./server_list.js";
import { weatherWindow } from "../../engine/los.js";
import { TIME_LIMIT_TICKS } from "../../engine/victory.js"; // item 27: the war clock
import { frameRect, sheetName } from "./sprite_frames.js";
import { buildMinimapModel, minimapClickToCell } from "./minimap_model.js";
import { createCamera, panForKey } from "./camera_model.js";
import { describeEvent, summarizeGameOver, topOperators, deathRecapLine, categoryHonors } from "./feedback_model.js";
import { pingOptionsFor, wheelOptionsFor } from "./ping_model.js";
import { createSplash } from "./splash_model.js";
import { compassOctant } from "../../engine/reducer.js";
import { tasksFor } from "./tasks_model.js";
import { propsFor, baseCompound } from "./props_model.js";
import { updateGhosts, ghostOpacity } from "./ghosts_model.js";
import { statusFor } from "./status_model.js";
import { codexFor, codexAll, MECHANICS_PAGES } from "./codex.js";
import { t, setLocale, getLocale } from "./strings.js";
import { DEFAULT_BINDS, loadBinds, saveBinds } from "./keybinds.js";
import {
  arrowDrive, ARROW_BRADS, classifyTouch, pinchFactor, isTouchDevice,
} from "./touch_model.js";
import { factionFor } from "../../shared/factions.js";
import { activePings } from "../../engine/pings.js";
import { smoothHeading, angleDelta, TURN_RATE_RAD_PER_SEC } from "./heading.js";
import { buildProcedural, setStyleTokens, applyTeamColor, applyFactionScheme } from "./asset_factory.js";
import { visualKeyFor, standardVisualKey, resolveVisual, teamToken } from "./asset_resolver.js";
import {
  ownStandardLine, enemyStandardLine, relayTally, currentHint, briefingText, autoSelectTarget,
} from "./objective_model.js";

const CELL = 256; // fixed world units per cell
const TERRAIN_COLORS = [0x3e5a3e, 0x8a8a72, 0x274427, 0x5e5240, 0x2b2b33, 0x6e5f42, 0x2a4a66]; // 11N path, 12C water
const STATE_DISABLED = 2;

let socket = null;
let joined = null; // { operatorId, team }
let scene, camera, renderer, raycaster;
let terrainMesh = null;
const assetMeshes = new Map(); // id -> Mesh
const siteMeshes = new Map(); // id -> Mesh
let renderedEnemyIds = new Set();
const interpolator = createInterpolator({ delayMs: 150 });
let mySelectedAssetId = null;
let autoSelectSent = false; // post-playtest: crew a unit automatically on join
let lastDrivenAssetId = -1; // B7: which hull was mine, one view ago
let deathRecap = null;      // B7: the asset_disabled event that unseated me
// B5 comm wheel: options while Q is held, else null. pick = hovered
// sector. lastPointer feeds both sector selection and the release-time
// ground pick.
let commWheel = null;
let lastPointer = { x: 0, y: 0 };
// B5 auto-callouts: enemyId -> last-seen ms, so a fog flicker does not
// re-announce the same hull every second.
const contactSeen = new Map();
let lastCalloutAt = 0;
// Splash ("The Front Ignites", designer brief): splash_model owns the
// rules; this is just the DOM hand. Removed from the DOM when done.
let splashCtl = null;

function startSplash() {
  const el = document.getElementById("splash");
  if (!el) return;
  const $ = (id) => document.getElementById(id);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const seen = localStorage.getItem("fc_splash_seen") === "1";
  splashCtl = createSplash({ seenBefore: seen, reducedMotion: reduced });
  try { localStorage.setItem("fc_splash_seen", "1"); } catch { /* private mode */ }
  $("splash-tag").textContent = t("splash.tagline");
  const bootLines = ["splash.boot1", "splash.boot2", "splash.boot3", "splash.boot4"];
  const addBoot = (i) => { $("splash-boot").textContent += (i ? "\n" : "") + t(bootLines[i]); };
  const showTitle = () => {
    $("splash-title").style.opacity = "1";
    $("splash-tag").style.opacity = "1";
  };
  if (splashCtl.state.reducedMotion) {
    $("splash-map").style.opacity = "0.4";
    showTitle();
  } else {
    const steps = [
      [300, () => { $("splash-map").style.opacity = "1"; addBoot(0); }],
      [800, () => {
        const f = $("splash-front");
        f.style.transition = "stroke-dashoffset 0.8s ease-out";
        f.style.strokeDashoffset = "0";
        addBoot(1);
      }],
      [1600, () => { $("splash-west").style.opacity = "0.35"; $("splash-east").style.opacity = "0.35"; }],
      [2200, () => {
        const g = $("splash-pips");
        for (let i = 0; i < 8; i++) {
          const p = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          p.setAttribute("cx", 340 + (i % 2) * 120 + (i * 13) % 40);
          p.setAttribute("cy", 60 + i * 45);
          p.setAttribute("r", 3);
          p.setAttribute("fill", i % 2 ? "#7a3a1a" : "#2a3f5f");
          g.appendChild(p);
        }
        g.style.opacity = "1";
        addBoot(2);
      }],
      [2800, () => { $("splash-standard").style.opacity = "1"; }],
      [3200, showTitle],
      [3800, () => addBoot(3)],
    ];
    for (const [ms, fn] of steps) setTimeout(() => { if (!splashCtl.done()) fn(); }, ms);
  }
  const teardown = () => {
    window.removeEventListener("keydown", keySkip);
    el.style.pointerEvents = "none"; // stop intercepting the instant we fade
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 500); // REMOVED, never merely hidden
  };
  const settle = () => {
    if (splashCtl.done()) { teardown(); return; }
    showTitle(); // hold state: title up, honest status line
    $("splash-status").textContent = splashCtl.state.preparing ? t("splash.preparing") : "";
    $("splash-status").style.opacity = splashCtl.state.preparing ? "1" : "0";
  };
  const skip = () => { splashCtl.skip(); settle(); };
  el.addEventListener("pointerdown", skip);
  const keySkip = (e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") skip(); };
  window.addEventListener("keydown", keySkip);
  setTimeout(() => { splashCtl.timeUp(); settle(); }, splashCtl.state.minMs);
  splashCtl.notifyReady = () => { splashCtl.assetsReady(); settle(); };
}

function splashAssetsReady() {
  splashCtl?.notifyReady?.();
}
const worldLabels = new Map(); // labelKey -> Sprite
const freeCam = createCamera({ mapSize: 128 }); // 8G
const standardMeshes = new Map(); // team -> Mesh (8F/8A)
const downedMeshes = new Map(); // operatorId -> Mesh (9B)
const mineMeshes = new Map(); // mineId -> Mesh (9E)
const caltropMeshes = new Map(); // caltropId -> Mesh (Q45)
const sandbagMeshes = new Map(); // sandbagId -> Mesh (Q45/Q50)
const prisonFigures = new Map(); // "g0"/"p0-2" -> Mesh (figure kit)
let alarmFlashUntil = 0;         // wall-clock ms; cosmetic only
const droneMeshes = new Map(); // droneId -> Mesh (9G)
let fogGhosts = []; // 13E: last-seen enemy contacts
const ghostMeshes = new Map(); // enemyId -> Mesh (13E)
let lastSelectAttempt = -1; // 10B
let pendingTakeover = -1;   // 10B: asset awaiting Enter-confirm
const teamPings = []; // 10C: recent own-team pings for world labels
let BINDS = loadBinds(); // 15C: remappable action keys
// 15A mobile: the arrow pad sets a desired heading; a controller loop
// converts it into drive intents until the unit is tapped to stop.
let touchDesiredBrads = null;
let lastTouchDrive = "";
// 11L direct control (G toggles): WASD becomes tank controls.
let directMode = false;
const driveHeld = { w: false, a: false, s: false, d: false };
let lastDriveSent = "0,0";
let directRing = null; // 11O: the tracking targeting circle
const orderMarkers = []; // 14I: click-order feedback {sprite, bornMs}
let lastMyScore = null; // 14J: mission-complete toast trigger
let toastUntil = 0;
let dragPan = null; // item 28: right-button drag-pan anchor, or null
let boardCollapsed = localStorage.getItem("mf_board_collapsed") === "1";
const eventFeed = [];
let liveVfx = [];
// 14C motion pass: cues (recoil/tracer/dust) + per-hull dust bookkeeping.
let liveMotion = [];
let spawnRingUntil = 0; // playtest-7 item 20: green locator ring after respawn
let spawnRingMesh = null;
const motionMeshes = new Map(); // tracer/dust cue -> Mesh
const dustTrack = new Map(); // assetId -> { x, z, lastEmitMs }
const vfxMeshes = new Map(); // effect object -> Mesh
const barMeshes = new Map(); // asset id -> Sprite
let overlayGroup = null;
let overlayKey = "";
let audioCtx = null;

const CUE_TONES = {
  fire_cannon: { freq: 110, ms: 90, type: "square", gain: 0.12 },
  explosion: { freq: 55, ms: 350, type: "sawtooth", gain: 0.2 },
  capture: { freq: 660, ms: 250, type: "sine", gain: 0.12 },
  resupply: { freq: 440, ms: 120, type: "triangle", gain: 0.08 },
  war_over: { freq: 330, ms: 900, type: "sine", gain: 0.15 },
};

// Placeholder synth cues until an art/audio direction is chosen.
function playCue(cue) {
  const tone = CUE_TONES[cue];
  if (!tone) return;
  try {
    audioCtx ??= new (window.AudioContext ?? window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = tone.type;
    osc.frequency.value = tone.freq;
    gain.gain.setValueAtTime(tone.gain, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + tone.ms / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + tone.ms / 1000);
  } catch { /* audio unavailable */ }
}

// 14D: WebGL probe — absent (or ?renderer=2d) boots the sprite fallback,
// a spectator-grade 2D view. The 3D path stays completely untouched.
function webglAvailable() {
  try {
    const probe = document.createElement("canvas");
    return !!(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch { return false; }
}

function init() {
  startSplash(); // both renderers get the front-ignites boot
  if (new URLSearchParams(location.search).get("renderer") === "2d" || !webglAvailable()) {
    init2dFallback();
    return;
  }
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101018);

  const aspect = window.innerWidth / window.innerHeight;
  const d = 18;
  camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
  camera.position.set(64 + 18, 26, 64 + 18);
  camera.lookAt(64, 0, 64);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("canvas-container").appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(30, 50, 20);
  scene.add(sun);

  raycaster = new THREE.Raycaster();

  window.addEventListener("resize", onWindowResize);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  if (isTouchDevice()) setupTouch(); // 15A

  // Item 28: hold the RIGHT button and drag to pan, like the arrow keys
  // but continuous. The context menu is suppressed on the canvas only,
  // and the drag is converted from pixels to CELLS using the current
  // zoom so it tracks the ground under the cursor at any scale.
  renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (event.button !== 2) return;
    dragPan = { x: event.clientX, y: event.clientY };
    renderer.domElement.setPointerCapture?.(event.pointerId);
  });
  const endDragPan = (event) => {
    if (dragPan) renderer.domElement.releasePointerCapture?.(event.pointerId);
    dragPan = null;
  };
  renderer.domElement.addEventListener("pointerup", endDragPan);
  renderer.domElement.addEventListener("pointercancel", endDragPan);

  renderer.domElement.addEventListener("pointermove", (event) => { // 14I
    if (dragPan) {
      // Screen->world: the camera looks down the (+x,+z) diagonal, so a
      // pixel of screen x maps to world (x - z) and screen y to (x + z).
      const cellsPerPixel = (freeCam.state.zoom * 2) / window.innerHeight;
      const dx = (event.clientX - dragPan.x) * cellsPerPixel;
      const dy = (event.clientY - dragPan.y) * cellsPerPixel;
      freeCam.pan(-(dx + dy) * 0.7071, (dx - dy) * 0.7071);
      dragPan = { x: event.clientX, y: event.clientY };
      return;
    }
    const now = performance.now();
    if (now - lastHoverMs < 90) return;
    lastHoverMs = now;
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([...assetMeshes.values()], true);
    let found = null;
    for (const hit of hits) {
      let node = hit.object;
      while (node && node.userData.assetId === undefined) node = node.parent;
      if (node) { found = node.userData.assetId; break; }
    }
    hoverAssetId = found;
  });
  // Both centre buttons resolve position the same honest way (items 25/29).
  document.getElementById("btn-recenter").onclick = centreOnMe;
  document.getElementById("btn-next-asset").onclick = selectNextAsset;

  // 8G: free camera controls (11L: direct mode claims WASD first).
  window.addEventListener("keydown", (e) => {
    // 15C binds — declared FIRST: this handler once read k before this
    // line existed below it, and the TDZ throw killed EVERY keypress
    // (caught by the Playwright smoke the day it ran locally).
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === BINDS.directDrive) {
      directMode = !directMode;
      if (!directMode) { for (const k in driveHeld) driveHeld[k] = false; }
      sendDriveIntent();
      pushEvent(directMode ? t("ui.direct_on") : t("ui.direct_off"));
      if (directMode) freeCam.followMode(true);
      return;
    }
    if (directMode && e.key.toLowerCase() in driveHeld) {
      driveHeld[e.key.toLowerCase()] = true;
      sendDriveIntent();
      return;
    }
    const pan = panForKey(e.key);
    if (pan) { freeCam.pan(pan.dx, pan.dy); return; }
    if (e.key === "f" || e.key === "F") centreOnMe(); // item 29
    // Item 31: stats for whatever you are pointing at, or your own hull.
    if (k === BINDS.stats) {
      const view = interpolator.latest();
      const target = hoverAssetId !== null
        ? view?.friendlyAssets?.find((a) => a.id === hoverAssetId)
        : view?.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId);
      if (target) showCodex(target.type);
      return;
    }
    if (e.key === "Home") {
      const zone = interpolator.latest()?.bases?.find((b) => b.team === joined?.team);
      if (zone) freeCam.jumpTo(zone.x + zone.width / 2, zone.y + zone.height / 2);
    }
    if (k === BINDS.redeploy) send({ type: "redeploy" }); // 9B
    // 11G manual rescue: B boards the adjacent carrier, U hops out.
    if (k === BINDS.board) {
      const carrier = adjacentBoardableCarrier(interpolator.latest());
      if (carrier) send({ type: "board_carrier", carrierAssetId: carrier.id });
    }
    if (k === BINDS.unboard) send({ type: "unboard" });
    // 12B: H toggles the Sentinel's hardpoint.
    if (k === BINDS.hardpoint) {
      const me = interpolator.latest()?.friendlyAssets?.find(
        (a) => a.operatorId === joined?.operatorId);
      if (me?.type === 7) {
        send({ type: me.deployed === 1 ? "undeploy" : "deploy_hardpoint" });
      }
    }
    // 11U: T tows the adjacent claimable wreck (same as the banner).
    if (k === BINDS.tow) {
      const wreck = adjacentTowableWreck(interpolator.latest());
      if (wreck) send({ type: "tow_order", wreckAssetId: wreck.id });
    }
    // 13A: V transfers cargo to the neediest adjacent friendly (F is
    // camera-follow — hands off).
    if (k === BINDS.transfer) {
      const needy = adjacentNeedyFriendly(interpolator.latest());
      if (needy) send({ type: "transfer_cargo", targetAssetId: needy.id });
    }
    // 10B: Enter confirms a pending consequential takeover; Esc declines.
    if (e.key === "Enter" && pendingTakeover !== -1) {
      send({ type: "select_asset", assetId: pendingTakeover, confirm: true });
      pendingTakeover = -1;
    }
    if (e.key === "Escape") pendingTakeover = -1;
    // 9E: M lays a mine under the tank; C clears the nearest adjacent
    // known mine with a truck.
    if (k === BINDS.mine) {
      // Q45: the same key strews caltrops from a light chassis (bike/
      // scout carry chase-shapers, never mines) and lays a mine from a
      // tank — the server owns the contract either way.
      const meNow = interpolator.latest()?.friendlyAssets?.find(
        (a) => a.operatorId === joined?.operatorId);
      send({ type: (meNow?.caltropsLeft ?? 0) > 0 ? "deploy_caltrops" : "deploy_mine" });
    }
    // Q45/Q50: N builds a sandbag wall on the cell the truck faces.
    if (k === "n") {
      const meNow = interpolator.latest()?.friendlyAssets?.find(
        (a) => a.operatorId === joined?.operatorId);
      if (meNow && (meNow.sandbagsLeft ?? 0) > 0) {
        const cx = Math.floor(meNow.x / CELL);
        const cy = Math.floor(meNow.y / CELL);
        const brads = meNow.heading ?? 0;
        const dx = Math.round(Math.cos((brads / 256) * Math.PI * 2));
        const dy = Math.round(Math.sin((brads / 256) * Math.PI * 2));
        send({ type: "build_sandbag", targetCellX: cx + dx, targetCellY: cy + (dy || (dx === 0 ? 1 : 0)) });
      }
    }
    // B5: hold Q for the comm wheel (release sends, centre = cancel).
    if (k === BINDS.comm && !e.repeat) showCommWheel();
    // Prompt-100: J joins the hovered vacant station, or leaves mine.
    // Q41: a DRIVER pressing J with a manned station starts the EJECT
    // (server-run 2.5s warning the crew sees on their own screen).
    if (k === BINDS.station) {
      const v = interpolator.latest();
      const driving = v?.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId);
      if (driving && driving.stationOp !== -1) {
        send({ type: "eject_station" });
      } else if (whereAmI(v)?.kind === "stationed") {
        send({ type: "leave_station" });
      } else if (hoverAssetId !== null) {
        const target = v?.friendlyAssets?.find((x) => x.id === hoverAssetId);
        if (target && getUnitStats(target.type).station && target.stationOp === -1) {
          send({ type: "board_station", assetId: target.id });
        }
      }
    }
    // 10C: 1/2/3 send context pings (what they mean depends on your seat).
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      const opts = pingOptionsFor(interpolator.latest(), joined?.operatorId);
      const pick = opts[Number(e.key) - 1];
      if (pick) send({ type: "ping", kind: pick.kind });
    }
    if (k === BINDS.clearMine) {
      const v = interpolator.latest();
      const mine = nearestAdjacentMine(v);
      if (mine) send({ type: "clear_mine", mineId: mine.id });
    }
    if (e.key === "x" || e.key === "X") {
      const enemyStd = interpolator.latest()?.standards?.find((st) => st.team !== joined?.team);
      if (enemyStd) freeCam.jumpTo(enemyStd.x / CELL, enemyStd.y / CELL);
    }
  });
  window.addEventListener("keyup", (e) => { // 11L
    if (directMode && e.key.toLowerCase() in driveHeld) {
      driveHeld[e.key.toLowerCase()] = false;
      sendDriveIntent();
    }
    if (e.key.toLowerCase() === BINDS.comm) releaseCommWheel(); // B5
  });
  window.addEventListener("pointermove", (e) => { // B5: wheel + ground pick
    lastPointer = { x: e.clientX, y: e.clientY };
    if (commWheel) updateCommWheel();
  });
  renderer.domElement.addEventListener("wheel", (e) => {
    freeCam.zoomBy(e.deltaY > 0 ? 1.15 : 1 / 1.15);
    e.preventDefault();
  }, { passive: false });

  // 8F: minimap click jumps the camera.
  const minimap = document.getElementById("minimap");
  minimap.addEventListener("pointerdown", (e) => {
    const rect = minimap.getBoundingClientRect();
    const { cellX, cellY } = minimapClickToCell(
      e.clientX - rect.left, e.clientY - rect.top, rect.width, 128
    );
    freeCam.jumpTo(cellX, cellY);
  });
  document.getElementById("btn-join-a").onclick = () => joinTeam(0);
  document.getElementById("btn-join-b").onclick = () => joinTeam(1);
  document.getElementById("btn-spectate").onclick = spectate; // 10A
  document.getElementById("action-banner").onclick = () => bannerAction?.(); // 11U
  // 15B part 3: the static page speaks the active locale too.
  applyPageStrings();

  // 14K: the field encyclopedia (playtest 6.1's "option button").
  const encBtn = document.getElementById("btn-encyclopedia");
  const encOverlay = document.getElementById("encyclopedia-overlay");
  if (encBtn && encOverlay) {
    encBtn.onclick = () => {
      if (encOverlay.style.display === "block") {
        encOverlay.style.display = "none";
        return;
      }
      encOverlay.style.display = "block";
      const unitCard = (c) =>
        `<div style="background:#181824; border-radius:8px; padding:10px 14px; width:250px;">` +
        `<b style="color:#f5e96b;">${c.name.toUpperCase()}</b>` +
        `<div style="color:#9ab; font-size:12px; margin:3px 0;">${c.role}</div>` +
        c.lines.map(([k, v]) => `<div style="font-size:12px;">${k}: <b>${v}</b></div>`).join("") +
        (c.traits.length ? `<div style="font-size:11px; color:#f5e96b; margin-top:3px;">${c.traits.join(" · ")}</div>` : "") +
        `</div>`;
      encOverlay.innerHTML =
        `<div style="max-width:860px; margin:0 auto; font-family:sans-serif; color:#d8e6c8;">` +
        `<h2 style="letter-spacing:2px;">${t("enc.title")} <span id="enc-close" style="float:right; cursor:pointer; color:#7fd4ff;">×</span></h2>` +
        `<h3 style="color:#f5e96b;">${t("enc.units")}</h3>` +
        `<div style="display:flex; flex-wrap:wrap; gap:10px;">` +
        codexAll().map(unitCard).join("") + `</div>` +
        `<h3 style="color:#f5e96b; margin-top:18px;">${t("enc.mechanics")}</h3>` +
        MECHANICS_PAGES.map((key) =>
          `<div style="background:#181824; border-radius:8px; padding:10px 14px; margin:8px 0; font-size:13px;">${t(key)}</div>`
        ).join("") +
        `</div>`;
      document.getElementById("enc-close").onclick = () => { encOverlay.style.display = "none"; };
    };
  }

  // 15C: a11y — restore contrast/scale, wire the ⚙ controls.
  applyA11y();
  const contrastEl = document.getElementById("opt-contrast");
  if (contrastEl) {
    contrastEl.checked = localStorage.getItem("mf_contrast") === "1";
    contrastEl.onchange = (e) => {
      localStorage.setItem("mf_contrast", e.target.checked ? "1" : "0");
      applyA11y();
    };
  }
  const scaleEl = document.getElementById("opt-fontscale");
  if (scaleEl) {
    scaleEl.value = localStorage.getItem("mf_fontscale") ?? "1";
    scaleEl.onchange = (e) => {
      localStorage.setItem("mf_fontscale", e.target.value);
      applyA11y();
    };
  }
  const bindsEl = document.getElementById("opt-binds");
  if (bindsEl) {
    renderBindRows(bindsEl);
  }

  // 15B: locale — restore, and offer the switch in ⚙.
  setLocale(localStorage.getItem("mf_locale") ?? "en");
  const localeSel = document.getElementById("opt-locale");
  if (localeSel) {
    localeSel.value = getLocale();
    localeSel.onchange = (e) => {
      setLocale(e.target.value);
      localStorage.setItem("mf_locale", e.target.value);
      lastTaskKey = ""; // force HUD rebuilds in the new language
      for (const [, entry] of worldLabels) scene.remove(entry.sprite);
      worldLabels.clear();
      applyPageStrings(); // 15B part 3: the static chrome follows too
    };
  }
  // 11G: settings panel.
  const settingsOverlay = document.getElementById("settings-overlay");
  document.getElementById("btn-settings").onclick = () => {
    settingsOverlay.style.display = settingsOverlay.style.display === "flex" ? "none" : "flex";
  };
  document.getElementById("btn-settings-close").onclick = () => {
    settingsOverlay.style.display = "none";
  };
  document.getElementById("opt-auto-rescue").onchange = (e) => {
    send({ type: "set_option", option: "auto_rescue", value: e.target.checked ? 1 : 0 });
  };

  // Perf-harness hook (tools/perf_harness.mjs): read-only telemetry.
  window.__mfDebug = {
    renderer: () => renderer,
    scene: () => scene,
    labelCount: () => worldLabels.size,
    cam: () => ({ ...freeCam.state }), // UI acceptance: camera assertions
    joined: () => joined,
    selectedAsset: () => mySelectedAssetId,
    // playtest-8 acceptance surface
    whereAmI: () => whereAmI(interpolator.latest()),
    notice: () => {
      const el = document.getElementById("centre-notice");
      return el && el.style.display === "block" ? el.textContent : null;
    },
  };

  loadAssetMetadata().then(() => {
    connect();
    animate();
    loadGlobalServers(); // discovery: the join screen's global list
  });
}

// Discovery: the join screen's GLOBAL SERVERS list. Honesty over
// curation (specs/game-discovery.md): mismatches greyed, never hidden;
// no master configured = an actionable line, not a dead end.
async function loadGlobalServers() {
  const el = document.getElementById("global-servers");
  if (!el) return;
  try {
    const version = await (await fetch("/version")).json();
    if (!version.masterUrl) {
      el.textContent = t("disc.no_master");
      return;
    }
    const { servers } = await (await fetch(`${version.masterUrl}/servers`)).json();
    const rows = rowsFor(servers, version);
    if (!rows.length) {
      el.textContent = t("disc.empty");
      return;
    }
    el.innerHTML = `<div style="color:#ccc; letter-spacing:1px; margin-bottom:4px;">${t("disc.title")}</div>` +
      rows.map((r) => {
        const grey = r.versionMatch ? "" : "opacity:0.45;";
        const hint = r.versionMatch ? "" : ` <span style="color:#c96;">${r.versionHint}</span>`;
        return `<div style="${grey}"><a href="${r.url}" style="color:#8fd48f;">${r.name}</a>` +
          ` — ${t("disc.seats", { n: r.openSeats })}${hint}` +
          ` <span style="color:#667;">(${r.freshSeconds}s)</span></div>`;
      }).join("");
    el.insertAdjacentHTML("beforeend",
      `<div style="color:#667; margin-top:4px;">${t("disc.trust")}</div>`);
  } catch {
    el.textContent = t("disc.unreachable");
  }
}

// 5B: stable per-browser identity so a refresh reattaches to your operator.
function myPlayerId() {
  let id = localStorage.getItem("mf_player_id");
  if (!id) {
    id = `p-${Math.random().toString(36).slice(2, 12)}`; // identity only, never game logic
    localStorage.setItem("mf_player_id", id);
  }
  return id;
}

let cachedMap = null; // 6A: terrain arrives once via s_map
let ASSET_TOKENS = null; // Art Slice A: style tokens + manifest drive visuals
let ASSET_MANIFEST = null;

async function loadAssetMetadata() {
  const [tokens, manifest] = await Promise.all([
    fetch("assets/metadata/style_tokens.json").then((r) => r.json()),
    fetch("assets/metadata/asset_manifest.json").then((r) => r.json()),
  ]);
  ASSET_TOKENS = tokens;
  ASSET_MANIFEST = manifest;
  setStyleTokens(tokens);
}

function connect() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${window.location.host}`);
  // Splash: the JOIN MENU is the deliverable ("all assets ready ->
  // reveal menu", the brief's ladder). Views require joining, and
  // joining sits BEHIND the splash — gating on the first view was a
  // deadlock the smoke gate caught on the first run.
  socket.addEventListener("open", () => splashAssetsReady());
  socket.onmessage = (event) => {
    hideReconnectBanner(); // any live message = the link is back (item 21)
    const msg = JSON.parse(event.data);
    if (msg.type === "s_map") {
      cachedMap = {
        width: msg.width, height: msg.height,
        cells: Uint8Array.from(msg.mapCells),
        profile: msg.mapProfile ?? "frontier_corridor",
        seed: 0, // filled async below — weather visuals need the seed (16G)
      };
      fetch("/version").then((r) => r.json())
        .then((v) => { if (cachedMap) cachedMap.seed = v.mapSeed >>> 0; })
        .catch(() => { /* cosmetic only — storm tint just stays off */ });
      if (terrainMesh) { scene.remove(terrainMesh); terrainMesh = null; } // new war terrain
    } else if (msg.type === "s_vote_open") {
      // Q49: map+mode pair vote on the end screen.
      showVote(msg.candidates ?? []);
    } else if (msg.type === "s_vote_ack") {
      const el = document.getElementById("vote-title");
      if (el) el.textContent = t("vote.locked");
    } else if (msg.type === "s_war_reset") {
      hideEndScreen();
      const vb = document.getElementById("vote-box");
      if (vb) vb.style.display = "none";
      mySelectedAssetId = null;
      autoSelectSent = false; // re-crew automatically in the new war
      pushEvent(t("ui.new_war"));
    } else if (msg.type === "s_server_closing") {
      pushEvent("server shutting down");
    } else if (msg.type === "s_spectating") { // 10A: omniscient read-only seat
      joined = { operatorId: -1, team: -1, spectator: true };
      autoSelectSent = true; // nothing to crew
      document.getElementById("join-overlay").style.display = "none";
      pushEvent(t("ui.spectating"));
    } else if (msg.type === "s_joined") {
      joined = { operatorId: msg.operatorId, team: msg.team };
      document.getElementById("join-overlay").style.display = "none";
      showBriefing();
      updateOpInfo(null);
    } else if (msg.type === "s_snapshot") {
      interpolator.push(msg.view, performance.now());
      if (!autoSelectSent && joined) {
        const target = autoSelectTarget(msg.view, joined.operatorId);
        if (target !== null) {
          autoSelectSent = true;
          mySelectedAssetId = target;
          send(buildSelectCommand(target));
          pushEvent(t("ui.crewing", { id: target }));
        } else if ((msg.view.friendlyAssets ?? []).some((a) => a.operatorId === joined.operatorId)) {
          autoSelectSent = true; // rejoin case: already crewed
        }
      }
      updateObjectiveStrip(msg.view);
      updateNextAssetButton(msg.view); // item 22
      updateWarClock(msg.view);        // item 27
      handleEvents(msg.view.events ?? []);
      announceContacts(msg.view); // B5: fog reveals become callouts
      splashAssetsReady(); // splash: belt-and-braces (open handler is primary)
      // B7: track the asset I drive AFTER the event pass — on the death
      // tick the view already shows me unseated, so the recap match
      // needs the PREVIOUS view's answer to "which hull is mine".
      {
        const driving = (msg.view.friendlyAssets ?? []).find(
          (a) => a.operatorId === joined?.operatorId);
        if (driving) lastDrivenAssetId = driving.id;
      }
      for (const cue of mapEventsToCues(msg.view.events, msg.view)) playCue(cue.cue);
      liveVfx.push(...mapEventsToVfx(msg.view.events, msg.view, performance.now()));
      liveMotion.push(...mapEventsToMotion(msg.view.events, msg.view, performance.now()));
      updateOpInfo(msg);
    } else if (msg.type === "s_rejected") {
      // Item 30: a refusal is a direct answer to something the player
      // just did — it belongs in front of them, in their language, not
      // as raw English in a corner feed. ("Clicking did nothing" was
      // this.) The takeover-confirm case has its own Enter-retry flow,
      // so it stays quiet here.
      const line = t(`rej.${msg.reason}`);
      pushEvent(line);
      if (msg.reason !== "takeover needs confirmation") flashNotice(line, 2200, "#ff6b52");
    }
  };
  socket.onclose = () => {
    pushEvent(t("net.lost_feed"));
    showReconnectBanner();
  };
}

// Playtest-7 item 21: a disconnect gets a CENTRAL red banner and 30 s of
// automatic reconnect attempts (every 3 s). After that, the banner turns
// actionable — the global server list arrives with the discovery slice
// (specs/game-discovery.md), so for now it offers retry + reload.
let reconnectTimer = null;
function showReconnectBanner() {
  let el = document.getElementById("reconnect-banner");
  if (!el) {
    el = document.createElement("div");
    el.id="reconnect-banner"; // (no spaces: the wiring net greps id="...")
    el.style.cssText = "position:absolute;top:38%;left:50%;transform:translateX(-50%);" +
      "background:rgba(140,20,20,0.94);color:#fff;padding:18px 34px;border-radius:10px;" +
      "font:bold 18px sans-serif;z-index:11;text-align:center;min-width:320px;";
    document.body.appendChild(el);
  }
  el.style.display = "block";
  let secs = 30;
  const tick = () => {
    if (secs <= 0) {
      el.innerHTML = `${t("net.gave_up")}<br><button class="btn" id="btn-retry-conn" style="margin-top:10px;">${t("net.retry")}</button>`;
      document.getElementById("btn-retry-conn").onclick = () => { secs = 30; attempt(); };
      clearInterval(reconnectTimer);
      reconnectTimer = null;
      return;
    }
    el.textContent = t("net.reconnecting", { s: secs });
  };
  const attempt = () => {
    tick();
    if (reconnectTimer) clearInterval(reconnectTimer);
    reconnectTimer = setInterval(() => {
      secs -= 1;
      if (secs % 3 === 0 && secs > 0) {
        try { connect(); } catch { /* next attempt */ }
      }
      tick();
    }, 1000);
  };
  attempt();
}

function hideReconnectBanner() {
  const el = document.getElementById("reconnect-banner");
  if (el) el.style.display = "none";
  if (reconnectTimer) { clearInterval(reconnectTimer); reconnectTimer = null; }
}

// 11L: stream the current WASD intent, only on change.
function sendDriveIntent() {
  const throttle = driveHeld.w ? 1 : driveHeld.s ? -1 : 0;
  const turn = driveHeld.d ? 1 : driveHeld.a ? -1 : 0;
  const key = `${throttle},${turn}`;
  if (key === lastDriveSent) return;
  lastDriveSent = key;
  send({ type: "drive", throttle, turn });
}

// 15B part 3: retranslate the static page chrome (join screen, buttons,
// hint bar). Called at boot and on locale change.
function applyPageStrings() {
  const setText = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  };
  setText("game-title", "page.title");
  setText("game-tagline", "page.tagline");
  const pitch = document.querySelector("#join-overlay p:not(#game-tagline)");
  if (pitch) pitch.textContent = t("page.pitch");
  setText("btn-join-a", "page.join_a");
  setText("btn-join-b", "page.join_b");
  setText("btn-spectate", "page.spectate");
  setText("btn-briefing-ok", "page.move_out");
  setText("btn-next-asset", "page.next_asset");
  setText("btn-recenter", "page.center");
  setText("hint-bar", "page.hints");
  const replayLink = document.querySelector('a[href="/replay.html"]');
  if (replayLink) replayLink.textContent = t("page.replays");
}

// 15C: apply contrast + font scale via a body class and CSS variable.
function applyA11y() {
  const contrast = localStorage.getItem("mf_contrast") === "1";
  document.body.classList.toggle("high-contrast", contrast);
  const scale = Number(localStorage.getItem("mf_fontscale") ?? "1");
  document.documentElement.style.setProperty("--ui-scale", String(scale));
}

// 15C: one row per action — click, press a key, done.
function renderBindRows(container) {
  container.innerHTML = "";
  for (const action of Object.keys(DEFAULT_BINDS)) {
    const row = document.createElement("button");
    row.className = "btn";
    row.style.cssText = "font-size:12px; padding:2px 8px; margin:2px;";
    row.textContent = `${action}: ${BINDS[action].toUpperCase()}`;
    row.onclick = () => {
      row.textContent = `${action}: press a key…`;
      const grab = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.key.length === 1) {
          BINDS[action] = ev.key.toLowerCase();
          saveBinds(BINDS);
        }
        window.removeEventListener("keydown", grab, true);
        renderBindRows(container);
      };
      window.addEventListener("keydown", grab, true);
    };
    container.appendChild(row);
  }
}

function joinTeam(team) {
  if (!socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify({ type: "c_join", team, playerId: myPlayerId() }));
}

// ── 15A: the touch layer (ruling Q10) ───────────────────────────────────
function setupTouch() {
  const pad = document.getElementById("touch-pad");
  if (!pad) return;
  pad.style.display = "block";
  const POS = {
    nw: [0, 0], n: [53, 0], ne: [106, 0],
    w: [0, 53], stop: [53, 53], e: [106, 53],
    sw: [0, 106], s: [53, 106], se: [106, 106],
  };
  const GLYPH = {
    n: "↑", ne: "↗", e: "→", se: "↘", s: "↓", sw: "↙", w: "←", nw: "↖", stop: "■",
  };
  for (const [key, [x, y]] of Object.entries(POS)) {
    const b = document.createElement("div");
    b.className = "tp-btn";
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
    b.textContent = GLYPH[key];
    if (key === "stop") b.style.color = "#ff6b52";
    b.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (key === "stop") stopTouchDrive();
      else touchDesiredBrads = ARROW_BRADS[key]; // set off in that direction
    });
    pad.appendChild(b);
  }

  // Canvas gestures: tap = order, drag = pan, pinch = zoom.
  const canvas = renderer.domElement;
  let touchStart = null;
  let lastPan = null;
  let pinchStart = null;
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      const to = e.touches[0];
      touchStart = { x: to.clientX, y: to.clientY, t: performance.now() };
      lastPan = { x: to.clientX, y: to.clientY };
    } else if (e.touches.length === 2) {
      touchStart = null;
      pinchStart = touchDistance(e.touches);
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1 && lastPan) {
      const to = e.touches[0];
      freeCam.pan((lastPan.x - to.clientX) / 14, (lastPan.y - to.clientY) / 14);
      lastPan = { x: to.clientX, y: to.clientY };
    } else if (e.touches.length === 2 && pinchStart) {
      const d = touchDistance(e.touches);
      freeCam.zoomBy(pinchFactor(pinchStart, d));
      pinchStart = d;
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("touchend", (e) => {
    if (touchStart && e.changedTouches.length === 1) {
      const to = e.changedTouches[0];
      const kind = classifyTouch(touchStart, { x: to.clientX, y: to.clientY },
        performance.now() - touchStart.t);
      if (kind === "tap") {
        // Tap MY unit = STOP (the Q10 rule); anywhere else = the normal
        // click order path.
        const fake = { clientX: to.clientX, clientY: to.clientY };
        if (tapIsOnMyUnit(fake)) stopTouchDrive();
        else onPointerDown(fake);
      }
    }
    touchStart = null;
    lastPan = null;
    pinchStart = null;
  });
}

function touchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function tapIsOnMyUnit(event) {
  const me = interpolator.latest()?.friendlyAssets?.find(
    (a) => a.operatorId === joined?.operatorId);
  if (!me) return false;
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  const mesh = assetMeshes.get(me.id);
  return !!mesh && raycaster.intersectObject(mesh, true).length > 0;
}

function stopTouchDrive() {
  touchDesiredBrads = null;
  lastTouchDrive = "";
  send({ type: "drive", throttle: 0, turn: 0 });
}

// The per-frame controller: steer toward the arrow heading via drive
// intents, sent only on change (rate-limit friendly).
function updateTouchDrive(view) {
  if (touchDesiredBrads === null) return;
  const me = view?.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId);
  if (!me) return;
  const intent = arrowDrive(me.heading ?? 0, touchDesiredBrads);
  const key = `${intent.throttle},${intent.turn}`;
  if (key !== lastTouchDrive) {
    lastTouchDrive = key;
    send({ type: "drive", throttle: intent.throttle, turn: intent.turn });
  }
}

function spectate() { // 10A
  if (!socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify({ type: "c_spectate" }));
}

function send(cmd) {
  if (!socket || socket.readyState !== 1 || !joined) return;
  socket.send(JSON.stringify(cmd));
}

// Playtest-8 items 25/29: WHERE AM I, honestly. "Centre on me" used to
// fall back to friendlyAssets[0] whenever you had no asset of your own —
// so while downed, respawning, or riding a carrier it silently centred on
// a random teammate ("centred on the last wreck mission", "could not see
// myself on any carrier"). There is no fallback now: if we cannot find
// you, we say so rather than point somewhere confident and wrong.
function whereAmI(view) {
  if (!view || !joined) return null;
  const mine = view.friendlyAssets?.find((a) => a.operatorId === joined.operatorId);
  if (mine) return { kind: "asset", x: mine.x, y: mine.y, assetId: mine.id };
  // Prompt-100: manning a station anchors you to that hull.
  const manned = view.friendlyAssets?.find(
    (a) => a.stationOp === joined.operatorId &&
      a.state !== STATE_DISABLED && a.state !== 3);
  if (manned) return { kind: "stationed", x: manned.x, y: manned.y, assetId: manned.id };
  const down = view.downedOperators?.find((d) => d.operatorId === joined.operatorId);
  if (down) return { kind: "downed", x: down.x, y: down.y };
  // Item 35: only an OPERABLE carrier counts as "riding". A wrecked one
  // must never anchor you to it — that stranded a player on the hulk of
  // the van they had spawned into.
  const carrier = view.friendlyAssets?.find(
    (a) => (a.aboard1 === joined.operatorId || a.aboard2 === joined.operatorId) &&
      a.state !== STATE_DISABLED && a.state !== 3 /* SALVAGED */);
  if (carrier) return { kind: "aboard", x: carrier.x, y: carrier.y, assetId: carrier.id };
  return null;
}

// Item 29: the button now reports failure instead of quietly following
// someone else. Item 25: riding a carrier counts as "me".
function centreOnMe() {
  const me = whereAmI(interpolator.latest());
  if (!me) { flashNotice(t("notice.no_position")); return; }
  freeCam.jumpTo(me.x / CELL, me.y / CELL);
  freeCam.followMode(true);
  spawnRingUntil = performance.now() + 2000; // "you are HERE"
}

// Item 22/30: can a Next-asset press possibly succeed? The engine
// rejects selection while your seat is DOWN or respawning, and the
// rejection only ever reached a small corner feed in raw English —
// which is what "clicking did nothing" actually was.
function selectBlockedReason(view) {
  if (!view || !joined || joined.spectator) return "notice.spectating";
  if (view.downedOperators?.some((d) => d.operatorId === joined.operatorId)) {
    return "notice.on_foot";
  }
  const me = view.friendlyAssets?.find((a) => a.operatorId === joined.operatorId);
  if (!me && whereAmI(view)?.kind === "aboard") return "notice.aboard";
  const free = (view.friendlyAssets ?? []).filter(
    (a) => a.state !== STATE_DISABLED &&
      (a.operatorId === -1 || a.operatorId === joined.operatorId));
  if (free.length <= 1) return "notice.no_free_asset";
  return null;
}

// Item 22: the button tells the truth about whether it can do anything,
// and hovering says why not. (The user asked for base-area gating; the
// ENGINE has no such rule today — swapping seats in the field is legal
// and the AI crewing ladder depends on it — so this greys out for the
// conditions that actually block a selection. The base-area rule itself
// is filed as a design question in specs/07.)
function updateNextAssetButton(view) {
  const btn = document.getElementById("btn-next-asset");
  if (!btn) return;
  const blocked = selectBlockedReason(view);
  btn.disabled = blocked !== null;
  btn.style.opacity = blocked ? "0.45" : "1";
  btn.style.cursor = blocked ? "not-allowed" : "pointer";
  btn.title = blocked ? t(blocked) : "";
}

function selectNextAsset() {
  const view = interpolator.latest();
  if (!view) return;
  const blocked = selectBlockedReason(view);
  if (blocked) { flashNotice(t(blocked)); return; }
  const own = view.friendlyAssets.filter((a) => a.state !== STATE_DISABLED);
  if (own.length === 0) return;
  const free = own.filter((a) => a.operatorId === -1 || a.operatorId === joined.operatorId);
  const pool = free.length ? free : own;
  const idx = pool.findIndex((a) => a.id === mySelectedAssetId);
  const next = pool[(idx + 1) % pool.length];
  mySelectedAssetId = next.id;
  send(buildSelectCommand(next.id));
}

// B5: the comm wheel. Held-open radial of the seat's FULL ping
// vocabulary (the 1/2/3 keys keep their top-three); release sends the
// highlighted ping at the cursor's ground cell. A centre dead zone
// means open-and-release says nothing.
function showCommWheel() {
  const el = document.getElementById("comm-wheel");
  if (!el || commWheel || !joined || joined.spectator) return;
  const options = wheelOptionsFor(interpolator.latest(), joined.operatorId);
  if (!options.length) return;
  if (lastPointer.x === 0 && lastPointer.y === 0) {
    lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }
  el.innerHTML = "";
  const R = 130;
  options.forEach((o, i) => {
    const a = (i / options.length) * 2 * Math.PI - Math.PI / 2;
    const b = document.createElement("div");
    b.textContent = o.label;
    b.style.cssText =
      "position:absolute; transform:translate(-50%,-50%); white-space:nowrap;" +
      "background:rgba(10,10,14,0.85); color:#cfe; padding:6px 12px;" +
      "border-radius:6px; font:bold 13px sans-serif; border:1px solid #345;" +
      `left:${Math.round(Math.cos(a) * R)}px; top:${Math.round(Math.sin(a) * R)}px;`;
    el.appendChild(b);
  });
  el.style.display = "block";
  commWheel = { options, pick: -1 };
  updateCommWheel();
}

function updateCommWheel() {
  if (!commWheel) return;
  const el = document.getElementById("comm-wheel");
  const dx = lastPointer.x - window.innerWidth / 2;
  const dy = lastPointer.y - window.innerHeight / 2;
  let pick = -1;
  if (dx * dx + dy * dy > 30 * 30) {
    const n = commWheel.options.length;
    const a = Math.atan2(dy, dx) + Math.PI / 2; // sector 0 sits at 12 o'clock
    pick = ((Math.round((a / (2 * Math.PI)) * n) % n) + n) % n;
  }
  commWheel.pick = pick;
  [...el.children].forEach((c, i) => {
    c.style.background = i === pick ? "#2b4a2b" : "rgba(10,10,14,0.85)";
    c.style.color = i === pick ? "#9fe89f" : "#cfe";
  });
}

function releaseCommWheel() {
  if (!commWheel) return;
  const el = document.getElementById("comm-wheel");
  const { options, pick } = commWheel;
  commWheel = null;
  if (el) { el.style.display = "none"; el.innerHTML = ""; }
  if (pick < 0) return;
  const cmd = { type: "ping", kind: options[pick].kind };
  const mouse = new THREE.Vector2(
    (lastPointer.x / window.innerWidth) * 2 - 1,
    -(lastPointer.y / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(plane, target)) {
    const { cellX, cellY } = scenePointToCell(target.x, target.z);
    cmd.targetCellX = cellX;
    cmd.targetCellY = cellY;
  }
  send(cmd);
}

// B5 auto-callouts: a hull emerging from fog is NEWS — once. A 60 s
// per-hull memory beats fog flicker; an 8 s global cooldown keeps the
// feed from turning into a spotter's monologue.
function announceContacts(view) {
  const now = performance.now();
  const mine = view.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId);
  for (const en of view.visibleEnemies ?? []) {
    const last = contactSeen.get(en.id) ?? -1e9;
    contactSeen.set(en.id, now);
    if (now - last < 60000) continue;
    if (now - lastCalloutAt < 8000) continue;
    lastCalloutAt = now;
    let line = t("callout.contact", { chassis: t(`chassis.${en.type}`) });
    if (mine) {
      const oct = compassOctant(en.x - mine.x, en.y - mine.y);
      if (oct >= 0) {
        line = t("callout.contact_dir", { chassis: t(`chassis.${en.type}`), dir: t(`dir.${oct}`) });
      }
    }
    pushEvent(line);
  }
}

function onPointerDown(event) {
  if (!joined) return;
  if (event.button === 2) return; // item 28: right button pans, never orders
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, target)) return;

  const view = interpolator.latest();
  const { cellX, cellY } = scenePointToCell(target.x, target.z);
  // Prompt-100: at a station, clicking a visible enemy FIRES the mount.
  if (whereAmI(view)?.kind === "stationed") {
    const foe = (view?.visibleEnemies ?? []).find((e2) =>
      Math.floor(e2.x / CELL) === cellX && Math.floor(e2.y / CELL) === cellY);
    if (foe) send({ type: "station_fire", targetAssetId: foe.id });
    return; // a gunner's clicks never command vehicles
  }
  // 9B: while your seat is down, clicks crawl instead of commanding vehicles.
  if (view?.downedOperators?.some((d) => d.operatorId === joined.operatorId)) {
    // Prompt-51 AT satchel: clicking an ADJACENT enemy hull plants the
    // charge instead of crawling (the reducer enforces range and count).
    const foe = (view?.visibleEnemies ?? []).find((e) =>
      Math.floor(e.x / CELL) === cellX && Math.floor(e.y / CELL) === cellY);
    if (foe) {
      send({ type: "satchel", targetAssetId: foe.id });
      return;
    }
    send({ type: "crawl_order", targetCellX: cellX, targetCellY: cellY });
    return;
  }
  const own = view?.friendlyAssets?.find((a) => a.operatorId === joined.operatorId);
  const cmd = buildCommandForClick(view, cellX, cellY, {
    fireRadiusCells: 1, myOperatorId: joined.operatorId,
    canTow: own ? own.type === 3 : false,
    directMode, // 11O: weapons-only clicks with aim assist
    // Item 34: SHIFT-click queues a leg (classic RTS); on touch the
    // long-press does the same thing (setupTouch passes queue too).
    queue: event.shiftKey === true,
  });
  if (!cmd) return; // direct mode: nothing near the cursor — hold fire
  spawnOrderMarker(cmd, cellX, cellY); // 14I: show WHAT was ordered WHERE
  if (cmd.type === "select_asset") {
    mySelectedAssetId = cmd.assetId;
    lastSelectAttempt = cmd.assetId; // 10B: may need a confirmed retry
  }
  send(cmd);
}

function handleEvents(events) {
  for (const e of events) {
    const line = describeEvent(e, joined?.team);
    if (line) pushEvent(line);
    // B7: MY asset going down gets the recap — what killed me, from
    // where — held for the down banner and pushed to the feed once.
    if (e.type === "asset_disabled" && lastDrivenAssetId !== -1 &&
        e.assetId === lastDrivenAssetId) {
      deathRecap = e;
      pushEvent(deathRecapLine(e));
    }
    // 11U: your redeploy brings the view HOME and re-arms auto-select —
    // the answer to "my camera stayed on my corpse".
    if (e.type === "operator_redeployed" && e.operatorId === joined?.operatorId) {
      const zone = interpolator.latest()?.bases?.find((b) => b.team === joined?.team);
      if (zone) freeCam.jumpTo(zone.x + zone.width / 2, zone.y + zone.height / 2);
      autoSelectSent = false; // pick a fresh garage asset automatically
      mySelectedAssetId = null;
      freeCam.followMode(true);
      spawnRingUntil = performance.now() + 3000; // item 20: "you are HERE"
    }
    // 10B: arm the Enter-confirm retry for a consequential takeover.
    if (e.type === "rejected" && e.reason === "takeover needs confirmation") {
      pendingTakeover = lastSelectAttempt;
    }
    if (e.type === "ping") {
      teamPings.push(e); // 10C (view is already team-scoped)
      // Figure kit: the watchman's lamp burns for 5 s after his shout.
      if (e.kind === "prison_alarm") alarmFlashUntil = Date.now() + 5000;
    }
    // Q41: the eject warning lands CENTRE-SCREEN for the affected crew.
    if (e.type === "station_eject_warning" && e.operatorId === joined?.operatorId) {
      flashNotice(t("ev.station_eject_warning"), 2600, "#ff6b52");
    }
    // Item 26: the front rolling in halves every sensor on the map —
    // players must be TOLD, not left to notice their scouts going blind.
    if (e.type === "weather_front") {
      flashNotice(t(e.phase === "in" ? "notice.fog_in" : "notice.fog_out"), 3400,
        e.phase === "in" ? "#9ab" : "#ffd75e");
    }
    if (e.type === "game_over") showEndScreen();
  }
}

let endCountdown = null; // playtest-7 item 16: live countdown + fadeout
function showEndScreen() {
  const view = interpolator.latest();
  const summary = summarizeGameOver(view, joined?.team);
  if (!summary) return;
  const el = document.getElementById("end-overlay");
  document.getElementById("end-title").innerText = summary.title;
  const honors = topOperators(view);
  const awards = categoryHonors(view); // B4: per-category honors
  document.getElementById("end-reason").innerText = summary.reason +
    (honors.length ? "\n\nHONORS\n" + honors.join("\n") : "") +
    (awards.length ? "\n\n" + awards.join("\n") : "");
  document.getElementById("end-scores").innerText =
    `Team A ${summary.scores[0]} — ${summary.scores[1]} Team B`;
  el.style.opacity = "1";
  el.style.transition = "";
  el.style.display = "flex";
  // Item 16: a REAL countdown (postgame is 30 s of server ticks), then a
  // gentle fade so the next war's opening isn't a hard cut.
  if (endCountdown) clearInterval(endCountdown);
  let secs = 30;
  const nextEl = document.getElementById("end-next");
  nextEl.innerText = t("end.next_war", { s: secs });
  endCountdown = setInterval(() => {
    secs -= 1;
    if (secs > 0) {
      nextEl.innerText = t("end.next_war", { s: secs });
    } else {
      nextEl.innerText = t("end.next_war", { s: 0 });
      el.style.transition = "opacity 1.2s";
      el.style.opacity = "0";
      clearInterval(endCountdown);
      endCountdown = null;
    }
  }, 1000);
}

// Q49: render the postgame vote — one button per (map, mode) pair.
function showVote(candidates) {
  const box = document.getElementById("vote-box");
  const buttons = document.getElementById("vote-buttons");
  const title = document.getElementById("vote-title");
  if (!box || !buttons || !title) return;
  title.textContent = t("vote.title");
  buttons.innerHTML = "";
  candidates.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "btn";
    const mapName = t(`map.${c.map}`) !== `map.${c.map}` ? t(`map.${c.map}`) : c.map;
    b.textContent = c.mode === 1 ? t("vote.convoy_on", { map: mapName })
      : c.mode === 2 ? t("vote.heist_on", { map: mapName }) : mapName;
    b.onclick = () => send({ type: "c_vote", choice: i });
    buttons.appendChild(b);
  });
  box.style.display = "block";
}

function hideEndScreen() {
  const el = document.getElementById("end-overlay");
  if (endCountdown) { clearInterval(endCountdown); endCountdown = null; }
  el.style.transition = "";
  el.style.opacity = "1";
  el.style.display = "none";
}

function pushEvent(text) {
  eventFeed.push(text);
  while (eventFeed.length > 6) eventFeed.shift();
  document.getElementById("event-feed").innerHTML =
    eventFeed.map((t) => `<div>${t}</div>`).join("");
}

function updateOpInfo(msg) {
  const info = document.getElementById("op-info");
  if (!joined) { info.innerText = "Not joined"; return; }
  const tick = msg ? msg.tick : "-";
  const who = joined.spectator ? "Spectator" : factionFor(joined.team).short; // 12A
  info.innerText = `Op ${joined.operatorId} | ${who} | Tick ${tick}`;
  if (msg) document.getElementById("status-bar").innerText = `Hash ${msg.stateHash}`;
}

function updateSupplyBar(view) {
  const el = document.getElementById("supply-bar");
  const own = view?.friendlyAssets.find((a) => a.operatorId === joined?.operatorId);
  if (!own) { el.innerText = ""; return; }
  el.innerText = `Asset ${own.id} | HP ${own.hp} | Ammo ${own.ammo} | Fuel ${own.fuel}` +
    (own.type === 3 ? ` | ${t("ui.cargo", { fuel: own.cargoFuel, ammo: own.cargoAmmo })}` : "");
}

function buildTerrain() {
  if (terrainMesh || !cachedMap) return;
  const size = cachedMap.width;
  const cells = cachedMap.cells;
  const group = new THREE.Group();
  const geometries = new Map();
  for (let terrain = 0; terrain < TERRAIN_COLORS.length; terrain++) {
    geometries.set(terrain, []);
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      geometries.get(cells[y * size + x])?.push([x, y]);
    }
  }
  for (const [terrain, positions] of geometries) {
    if (!positions.length) continue;
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, terrain === 4 ? 0.8 : 0.1, 1),
      new THREE.MeshLambertMaterial({ color: TERRAIN_COLORS[terrain] }),
      positions.length
    );
    const m = new THREE.Matrix4();
    positions.forEach(([x, y], i) => {
      m.setPosition(x + 0.5, terrain === 4 ? 0.4 : 0, y + 0.5);
      mesh.setMatrixAt(i, m);
    });
    group.add(mesh);
  }
  // Art round 2c (prompt 25): instanced battlefield props — forest reads
  // as trees, rough as rocks, trails as trodden ruts, at a glance.
  const props = propsFor(cells, size, size, cachedMap.profile);
  const byKind = { tree: [], rock: [], rut: [], water: [], rail: [], reed: [], dash: [], bush: [] };
  for (const pr of props) byKind[pr.kind]?.push(pr);
  const PROP_GEO = {
    tree: () => {
      const g = new THREE.ConeGeometry(0.28, 0.85, 6);
      g.translate(0, 0.5, 0);
      return g;
    },
    rock: () => {
      const g = new THREE.DodecahedronGeometry(0.2, 0);
      g.translate(0, 0.12, 0);
      return g;
    },
    rut: () => {
      const g = new THREE.BoxGeometry(0.5, 0.02, 0.14);
      g.translate(0, 0.06, 0);
      return g;
    },
    water: () => {
      const g = new THREE.BoxGeometry(1, 0.04, 1);
      g.translate(0, 0.08, 0); // floats above the rough tile: reads as river
      return g;
    },
    rail: () => {
      const g = new THREE.BoxGeometry(0.12, 0.3, 1);
      g.translate(0, 0.25, 0);
      return g;
    },
    reed: () => {
      const g = new THREE.ConeGeometry(0.06, 0.5, 4);
      g.translate(0, 0.3, 0);
      return g;
    },
    dash: () => { // 14G: road center-line
      const g = new THREE.BoxGeometry(0.45, 0.015, 0.1);
      g.translate(0, 0.06, 0);
      return g;
    },
    bush: () => { // 14G: forest undergrowth
      const g = new THREE.SphereGeometry(0.22, 5, 4);
      g.scale(1, 0.55, 1);
      g.translate(0, 0.1, 0);
      return g;
    },
  };
  const PROP_COLOR = {
    tree: 0x1f3a1f, rock: 0x6a6a5e, rut: 0x574a34,
    water: 0x2a4a66, rail: 0x4a4136, reed: 0x3d5a2e,
    dash: 0xa8a184, bush: 0x2c4a26, // 14G
  };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3();
  for (const [kind, list] of Object.entries(byKind)) {
    if (!list.length) continue;
    const inst = new THREE.InstancedMesh(
      PROP_GEO[kind](),
      new THREE.MeshLambertMaterial({ color: PROP_COLOR[kind] }),
      list.length
    );
    list.forEach((pr, i) => {
      q.setFromAxisAngle(up, pr.rotation);
      one.set(pr.scale, pr.scale, pr.scale);
      m.compose(new THREE.Vector3(pr.x, 0.05, pr.y), q, one);
      inst.setMatrixAt(i, m);
    });
    group.add(inst);
  }
  terrainMesh = group;
  scene.add(group);
}

function upsertAssetMesh(a, friendly) {
  // Manifest-resolved visuals (Art Slice A): unit_<chassis> or wreck_<chassis>,
  // painted GLB when it exists, procedural stand-in until then.
  const visualKey = visualKeyFor(a);
  let mesh = assetMeshes.get(a.id);
  if (mesh && mesh.userData.visualKey !== visualKey) {
    scene.remove(mesh);
    assetMeshes.delete(a.id);
    mesh = null;
  }
  if (!mesh) {
    const resolved = resolveVisual(ASSET_MANIFEST, visualKey);
    mesh = (resolved.kind === "procedural" ? buildProcedural(resolved.key) : null)
      ?? new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x888888 }));
    // 14I: an unmissable facing chevron at the model's FRONT (+z). If a
    // unit ever reads as driving backwards, this arrow is the referee.
    const chevGeo = new THREE.ConeGeometry(0.09, 0.22, 3);
    chevGeo.rotateX(Math.PI / 2);
    const chev = new THREE.Mesh(chevGeo,
      new THREE.MeshBasicMaterial({ color: 0xf5e96b }));
    chev.position.set(0, 0.06, 0.55);
    mesh.add(chev);
    mesh.userData.assetId = a.id;
    mesh.userData.visualKey = visualKey;
    applyTeamColor(mesh, teamToken(ASSET_TOKENS, a.team).color);
    // 11Y/14B: faction paint (hulls toward the faction PRIMARY) + the
    // insignia decal on the panel. Wrecks stay ashen.
    if (!visualKey.startsWith("wreck_")) {
      applyFactionScheme(mesh, factionFor(a.team), a.id);
    }
    scene.add(mesh);
    assetMeshes.set(a.id, mesh);
  }
  mesh.position.set(a.x / CELL + 0.5, 0, a.y / CELL + 0.5);
  // 9F: the engine now owns headings (brads 0-255). Convert and smooth the
  // last visual step; fall back to motion-derived heading for old snapshots.
  const brads = typeof a.heading === "number" && a.heading >= 0 && a.heading <= 255
    ? a.heading : null;
  {
    // 11U: models are authored facing +z; engine theta runs from +x (east)
    // toward +y (south). rotation.y = pi/2 - theta makes barrel follow travel.
    // Item 36: while WALL-SLIDING the engine keeps the ordered bearing but
    // the hull moves sideways — when actual motion disagrees with the
    // reported heading by more than ~45°, face the motion (the wheels go
    // where the hull goes); the smoother hides the handover.
    let target = brads !== null ? Math.PI / 2 - (brads * Math.PI * 2) / 256 : null;
    const motion = typeof a.motionHeading === "number"
      ? Math.PI / 2 - a.motionHeading : null;
    if (motion !== null && (target === null || Math.abs(angleDelta(target, motion)) > Math.PI / 4)) {
      target = motion;
    }
    if (target !== null) {
      const prev = mesh.userData.smoothedHeading ?? target;
      const maxStep = TURN_RATE_RAD_PER_SEC / 60;
      mesh.userData.smoothedHeading = smoothHeading(prev, target, maxStep);
      mesh.rotation.y = mesh.userData.smoothedHeading;
    }
  }
  if (friendly && a.operatorId === joined?.operatorId) {
    mesh.scale.setScalar(1.15);
  } else if (a.state !== STATE_DISABLED) {
    mesh.scale.setScalar(1);
  }
  // 14C: recoil — a fired hull kicks back along its own barrel line
  // (forward is +z after rotation.y), then eases exactly home.
  for (const cue of liveMotion) {
    if (cue.kind !== "recoil" || cue.assetId !== a.id) continue;
    const k = recoilKick(motionAge(cue, performance.now())) * 0.12;
    mesh.position.x -= Math.sin(mesh.rotation.y) * k;
    mesh.position.z -= Math.cos(mesh.rotation.y) * k;
  }
  return mesh;
}

// 8D readability: tow cables between friendly towers and their wrecks.
const towCables = new Map(); // wreck id -> mesh
function updateTowCables(view) {
  const live = new Set();
  for (const wreck of view.friendlyAssets ?? []) {
    if (wreck.towedBy === -1 || wreck.towedBy === undefined) continue;
    const tower = view.friendlyAssets.find((t) => t.id === wreck.towedBy);
    if (!tower) continue;
    live.add(wreck.id);
    let cable = towCables.get(wreck.id);
    if (!cable) {
      cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 1, 5),
        new THREE.MeshStandardMaterial({ color: 0x2e2418, roughness: 0.95 })
      );
      scene.add(cable);
      towCables.set(wreck.id, cable);
    }
    const ax = tower.x / CELL + 0.5, az = tower.y / CELL + 0.5;
    const bx = wreck.x / CELL + 0.5, bz = wreck.y / CELL + 0.5;
    const dx = bx - ax, dz = bz - az;
    const len = Math.max(0.2, Math.hypot(dx, dz));
    cable.scale.set(1, len, 1);
    cable.position.set((ax + bx) / 2, 0.18, (az + bz) / 2);
    cable.rotation.z = Math.PI / 2;
    cable.rotation.y = -Math.atan2(dz, dx);
  }
  for (const [id, cable] of towCables) {
    if (!live.has(id)) { scene.remove(cable); towCables.delete(id); }
  }
}

function updateOverlays(view) {
  // 4A: supply rings + weapon range ring, rebuilt only when ownership changes.
  const key = JSON.stringify([
    view.sites?.map((s) => s.owner), joined?.operatorId,
    view.friendlyAssets.find((a) => a.operatorId === joined?.operatorId)?.id ?? -1,
  ]);
  if (key === overlayKey) return;
  overlayKey = key;
  if (overlayGroup) scene.remove(overlayGroup);
  overlayGroup = new THREE.Group();
  const ringMat = (color, opacity) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide });
  for (const o of supplyOverlays(view)) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(o.radiusCells - 0.15, o.radiusCells, 48),
      ringMat(0x4488ff, 0.35)
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(o.centerX, 0.05, o.centerY);
    overlayGroup.add(ring);
  }
  const range = weaponRangeOverlay(view, joined?.operatorId);
  if (range) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.2, range.radiusCells - 0.1), range.radiusCells, 48),
      ringMat(0xffcc44, 0.4)
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(range.centerX, 0.06, range.centerY);
    overlayGroup.add(ring);
  }
  scene.add(overlayGroup);
}

function updateHealthBars(view) {
  const seen = new Set();
  for (const bar of healthBars(view)) {
    if (bar.fraction === null) continue;
    seen.add(bar.id);
    let sprite = barMeshes.get(bar.id);
    if (!sprite) {
      sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x44ff44 }));
      scene.add(sprite);
      barMeshes.set(bar.id, sprite);
    }
    sprite.scale.set(Math.max(0.05, bar.fraction), 0.08, 1);
    sprite.material.color.setHex(bar.fraction > 0.5 ? 0x44ff44 : bar.fraction > 0.25 ? 0xffcc44 : 0xff4444);
    sprite.position.set(bar.x, 0.9, bar.y);
  }
  for (const [id, sprite] of barMeshes) {
    if (!seen.has(id)) { scene.remove(sprite); barMeshes.delete(id); }
  }
}

function updateVfx(nowMs) {
  liveVfx = pruneVfx(liveVfx, nowMs);
  const alive = new Set(liveVfx);
  for (const [fx, mesh] of vfxMeshes) {
    if (!alive.has(fx)) { scene.remove(mesh); vfxMeshes.delete(fx); }
  }
  for (const fx of liveVfx) {
    let mesh = vfxMeshes.get(fx);
    if (!mesh) {
      const color = fx.kind === "muzzle_flash" ? 0xffee88 : fx.kind === "explosion" ? 0xff6622 : 0x66ffcc;
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true })
      );
      mesh.position.set(fx.at.x, 0.6, fx.at.y);
      scene.add(mesh);
      vfxMeshes.set(fx, mesh);
    }
    const age = vfxAge(fx, nowMs);
    const grow = fx.kind === "capture_pulse" ? 1 + age * 3 : 1 + age * 1.5;
    mesh.scale.set(grow, grow, grow);
    mesh.material.opacity = 1 - age;
  }
}

// 14C: tracers + dust. Recoil rides the asset upsert; this owns the rest.
// Item 20: a pulsing green ring rides YOUR hull for 3 s after respawn.
function updateSpawnRing(nowMs, view) {
  const active = nowMs < spawnRingUntil && joined;
  const me = active
    ? view?.friendlyAssets?.find((a) => a.operatorId === joined.operatorId) : null;
  if (!me) {
    if (spawnRingMesh) { scene.remove(spawnRingMesh); spawnRingMesh = null; }
    return;
  }
  if (!spawnRingMesh) {
    spawnRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.92, 28),
      new THREE.MeshBasicMaterial({ color: 0x59e07a, transparent: true, side: THREE.DoubleSide }));
    spawnRingMesh.rotation.x = -Math.PI / 2;
    scene.add(spawnRingMesh);
  }
  const remain = (spawnRingUntil - nowMs) / 3000;
  const pulse = 1 + 0.18 * Math.sin(nowMs / 120);
  spawnRingMesh.scale.set(pulse, pulse, pulse);
  spawnRingMesh.material.opacity = Math.max(0.15, remain);
  spawnRingMesh.position.set(me.x / CELL + 0.5, 0.06, me.y / CELL + 0.5);
}

function updateMotion(nowMs) {
  // Dust: a puff behind any hull that is actually rolling.
  for (const [id, mesh] of assetMeshes) {
    const prev = dustTrack.get(id);
    const { x, z } = mesh.position;
    if (!prev) { dustTrack.set(id, { x, z, lastEmitMs: 0 }); continue; }
    const movedSq = (x - prev.x) ** 2 + (z - prev.z) ** 2;
    const step = dustStep(prev.lastEmitMs, nowMs, movedSq);
    if (step.emit) {
      liveMotion.push({ kind: "dust", at: { x, y: z }, bornMs: nowMs, ttlMs: MOTION_TTL_MS.dust });
    }
    dustTrack.set(id, { x, z, lastEmitMs: step.lastEmitMs });
  }
  for (const [id] of dustTrack) if (!assetMeshes.has(id)) dustTrack.delete(id);

  liveMotion = pruneMotion(liveMotion, nowMs);
  const alive = new Set(liveMotion);
  for (const [cue, mesh] of motionMeshes) {
    if (!alive.has(cue)) { scene.remove(mesh); motionMeshes.delete(cue); }
  }
  for (const cue of liveMotion) {
    if (cue.kind === "recoil") continue;
    let mesh = motionMeshes.get(cue);
    if (!mesh) {
      mesh = cue.kind === "tracer"
        ? new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xffc966 }))
        : new THREE.Mesh(
            new THREE.CircleGeometry(0.14, 8),
            new THREE.MeshBasicMaterial({ color: 0xb9a184, transparent: true, opacity: 0.5 }));
      if (cue.kind === "dust") {
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(cue.at.x, 0.03, cue.at.y);
      }
      scene.add(mesh);
      motionMeshes.set(cue, mesh);
    }
    const age = motionAge(cue, nowMs);
    if (cue.kind === "tracer") {
      const p = tracerPoint(cue.from, cue.to, age);
      mesh.position.set(p.x, 0.3 + p.h, p.y);
    } else {
      const grow = 1 + age * 2.2;
      mesh.scale.set(grow, grow, grow);
      mesh.material.opacity = 0.5 * (1 - age);
    }
  }
}

// 16G: the storm reads as distance fog + a dimmed sky. The schedule is
// the same pure function the engine uses (mapSeed from the cached map).
let stormOn = false;
function updateWeatherVisual(view) {
  if (!view || !cachedMap) return;
  const w = weatherWindow(cachedMap.seed >>> 0);
  const active = view.tick >= w.start && view.tick < w.end;
  if (active === stormOn) return;
  stormOn = active;
  if (active) {
    scene.fog = new THREE.Fog(0x8a8676, 18, 60);
    scene.background = new THREE.Color(0x6e6a5c);
  } else {
    scene.fog = null;
    scene.background = new THREE.Color(0x101018);
  }
}

function upsertStandardMesh(st) {
  const key = standardVisualKey(st);
  let mesh = standardMeshes.get(st.team);
  if (mesh && mesh.userData.visualKey !== key) {
    scene.remove(mesh);
    standardMeshes.delete(st.team);
    mesh = null;
  }
  if (!mesh) {
    const resolved = resolveVisual(ASSET_MANIFEST, key);
    mesh = buildProcedural(resolved.key ?? "standard_upright");
    mesh.userData.visualKey = key;
    scene.add(mesh);
    standardMeshes.set(st.team, mesh);
  }
  const token = teamToken(ASSET_TOKENS, st.team);
  applyTeamColor(mesh, st.status === 3 ? ASSET_TOKENS.colors.selection : token.color);
  // Carried standards ride high and bob (procedural anim per spec §11).
  const carried = st.status === 1;
  const bob = carried ? 0.12 * Math.sin(performance.now() / 180) : 0;
  mesh.position.set(st.x / CELL + 0.5, (carried ? 0.35 : 0) + bob, st.y / CELL + 0.5);
  mesh.rotation.y = performance.now() / 900;
}

function showBriefing() {
  const el = document.getElementById("briefing-overlay");
  document.getElementById("briefing-text").innerText =
    briefingText(joined?.team, joined ? factionFor(joined.team) : null,
      interpolator.latest()?.mapProfile ?? null,
      interpolator.latest()?.mission ?? null); // 12A/15B; premium + mode disclosure
  el.style.display = "flex";
  const close = () => { el.style.display = "none"; window.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Enter" || e.key === "Escape") close(); };
  document.getElementById("btn-briefing-ok").onclick = close;
  window.addEventListener("keydown", onKey);
}

function updateObjectiveStrip(view) {
  if (!joined) return;
  const own = view.friendlyAssets?.find((a) => a.operatorId === joined.operatorId);
  document.getElementById("obj-hint").innerText =
    currentHint(view, joined.team, { canCarry: own ? own.type === 4 : false });
  document.getElementById("obj-standards").innerText =
    `${ownStandardLine(view, joined.team)}  ·  ${enemyStandardLine(view, joined.team)}`;
  const relays = relayTally(view, joined.team);
  document.getElementById("obj-relays").innerText =
    `Relays ${relays.yours}/${relays.total}`;
}

// Floating world labels so objectives stop being anonymous polygons
// (playtest: "did not understand what was relay").
function makeTextSprite(text, colorHex) {
  // 11U: up to two lines ("\n"-separated) — details and countdowns fit.
  let lines = String(text).split("\n").slice(0, 2);
  // Playtest-7 item 19: a long single-liner wraps at the nearest space
  // around char 18 so unit labels stay readable over the battlefield.
  if (lines.length === 1 && lines[0].length > 18) {
    const s = lines[0];
    let cut = s.lastIndexOf(" ", 18);
    if (cut < 8) cut = s.indexOf(" ", 18);
    if (cut > 0) lines = [s.slice(0, cut), s.slice(cut + 1)];
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = lines.length > 1 ? 160 : 96;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 52px sans-serif";
  ctx.textAlign = "center";
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect((512 - w) / 2, 8, w, canvas.height - 16);
  ctx.fillStyle = colorHex;
  lines.forEach((line, i) => ctx.fillText(line, 256, 62 + i * 58));
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false,
  }));
  sprite.scale.set(4.4, lines.length > 1 ? 1.45 : 0.85, 1);
  return sprite;
}

function upsertWorldLabel(key, text, colorHex, x, y, z) {
  let entry = worldLabels.get(key);
  if (!entry || entry.text !== text) {
    if (entry) scene.remove(entry.sprite);
    const sprite = makeTextSprite(text, colorHex);
    entry = { sprite, text };
    scene.add(sprite);
    worldLabels.set(key, entry);
  }
  entry.sprite.position.set(x, y, z);
}

function updateWorldLabels(view) {
  for (const site of view.sites ?? []) {
    const who = site.owner === -1 ? t("label.who_neutral")
      : site.owner === joined?.team ? t("label.who_yours") : t("label.who_enemy");
    let color = site.owner === -1 ? "#cccccc"
      : site.owner === joined?.team ? "#9fe89f" : "#f0a0a0";
    let detail = null;
    if (site.hp === 0) {
      detail = t("label.relay_damaged");
      color = "#c9b28a";
    } else if (site.captureProgress > 0 && site.capturingTeam !== -1) {
      // 11U: the flip countdown, live over the flag.
      const secs = Math.ceil((30 - site.captureProgress) / 10);
      const hostile = site.capturingTeam !== joined?.team;
      detail = hostile && site.owner !== -1
        ? t("label.relay_dropping", { s: secs })
        : t("label.relay_raising", { s: secs });
      color = hostile ? "#ffb066" : "#f5e96b";
    }
    upsertWorldLabel(`site${site.id}`,
      detail ? `${t("label.relay", { who })}\n${detail}` : t("label.relay", { who }), color,
      site.cellX + 0.5, 2.1, site.cellY + 0.5);
  }
  for (const st of view.standards ?? []) {
    const mine = st.team === joined?.team;
    let text = mine ? t("label.std_yours") : t("label.std_enemy");
    if (st.status === 2) { // DROPPED: the auto-return countup matters
      const secs = Math.max(0, Math.ceil((600 - (st.droppedTimer ?? 0)) / 10));
      text = (mine ? t("label.std_yours_down") : t("label.std_enemy_open")) +
        "\n" + t("label.std_returns", { s: secs });
    }
    upsertWorldLabel(`std${st.team}`, text,
      mine ? "#9fe89f" : "#ffd75e",
      st.x / CELL + 0.5, 2.6, st.y / CELL + 0.5);
  }
  // 12B: hardpoint states over the Sentinel.
  for (const a of view.friendlyAssets ?? []) {
    const key = `hard${a.id}`;
    let textHp = null;
    if (a.deployTimer > 0) {
      textHp = a.deployed === 1
        ? t("label.deploying", { s: Math.ceil(a.deployTimer / 10) })
        : t("label.undeploying", { s: Math.ceil(a.deployTimer / 10) });
    } else if (a.deployed === 1) {
      textHp = t("label.hardpoint");
    }
    if (textHp) {
      upsertWorldLabel(key, textHp, "#bfe3e8", a.x / CELL + 0.5, 1.7, a.y / CELL + 0.5);
    } else {
      const entry = worldLabels.get(key);
      if (entry) { scene.remove(entry.sprite); worldLabels.delete(key); }
    }
  }
  // 11U: repair bays count down over the hull.
  for (const a of view.friendlyAssets ?? []) {
    const key = `repair${a.id}`;
    if (a.recoverTimer > 0) {
      upsertWorldLabel(key, t("label.repairing", { s: Math.ceil(a.recoverTimer / 10) }), "#8fd4ff",
        a.x / CELL + 0.5, 1.5, a.y / CELL + 0.5);
    } else {
      const entry = worldLabels.get(key);
      if (entry) { scene.remove(entry.sprite); worldLabels.delete(key); }
    }
  }
}

// 14D: lazy sprite-sheet cache for minimap icons (and future 2D uses).
const minimapSheets = new Map();
function minimapSheet(key, team) {
  const name = sheetName(key, team);
  if (!minimapSheets.has(name)) {
    const img = new Image();
    img.src = `assets/sprites/${name}`;
    minimapSheets.set(name, img);
  }
  return minimapSheets.get(name);
}

function renderMinimap(view) {
  const canvas = document.getElementById("minimap");
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const k = size / 128;
  ctx.fillStyle = "#0a0a10";
  ctx.fillRect(0, 0, size, size);

  const cam = freeCam.state;
  const aspect = window.innerWidth / window.innerHeight;
  const model = buildMinimapModel(
    { ...view, myOperatorId: joined?.operatorId },
    128,
    { x: cam.x, y: cam.y, halfW: cam.zoom * aspect, halfH: cam.zoom }
  );

  for (const z of model.zones) {
    ctx.fillStyle = z.team === joined?.team ? "rgba(60,180,60,0.25)" : "rgba(190,60,60,0.25)";
    ctx.fillRect(z.x * k, z.y * k, z.width * k, z.height * k);
  }
  for (const r of model.relays) {
    ctx.fillStyle = r.owner === -1 ? "#888"
      : r.owner === joined?.team ? "#4c4" : "#c44";
    ctx.fillRect(r.x * k - 2, r.y * k - 2, 4, 4);
  }
  for (const d of model.dots) {
    ctx.fillStyle = d.kind === "wreck" ? "#555"
      : d.kind === "friendly" ? (d.mine ? "#aaffaa" : "#3a3") : "#d33";
    ctx.fillRect(d.x * k - 1.5, d.y * k - 1.5, d.mine ? 4 : 3, d.mine ? 4 : 3);
  }
  for (const st of model.standards) {
    ctx.fillStyle = st.team === joined?.team ? "#8f8" : "#f88";
    if (st.status === 1 || st.status === 2) ctx.fillStyle = "#fd0"; // hot standard
    ctx.beginPath();
    ctx.arc(st.x * k, st.y * k, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // 14D seed: YOUR hull is its baked sprite frame, heading and all —
  // the first minimap unit icon; the rest stay dots for now.
  const me = (view.friendlyAssets ?? []).find((a) => a.operatorId === joined?.operatorId);
  if (me) {
    const img = minimapSheet(visualKeyFor(me).replace(/^unit_/, ""), me.team);
    if (img?.complete && img.naturalWidth > 0) {
      const r = frameRect(16, me.heading);
      ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh,
        (me.x / 256) * k - 8, (me.y / 256) * k - 8, 16, 16);
    }
  }
  if (model.viewport) {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.strokeRect(model.viewport.x * k, model.viewport.y * k,
      model.viewport.width * k, model.viewport.height * k);
  }
}

// 11G: the friendly carrier (free bunk) next to MY downed body, if any.
function adjacentBoardableCarrier(view) {
  const me = view?.downedOperators?.find((d) => d.operatorId === joined?.operatorId);
  if (!me) return null;
  return (view?.friendlyAssets ?? []).find((a) =>
    a.type === 4 && a.state !== STATE_DISABLED &&
    (a.aboard1 === -1 || a.aboard2 === -1) &&
    Math.max(Math.abs(Math.floor(a.x / CELL) - Math.floor(me.x / CELL)),
             Math.abs(Math.floor(a.y / CELL) - Math.floor(me.y / CELL))) <= 1) ?? null;
}

function nearestAdjacentMine(view) {
  const me = view?.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId);
  if (!me) return null;
  const cx = Math.floor(me.x / CELL);
  const cy = Math.floor(me.y / CELL);
  let best = null;
  let bestDist = 2;
  for (const m of view.mines ?? []) {
    const d = Math.max(Math.abs(m.cellX - cx), Math.abs(m.cellY - cy));
    if (d < bestDist) { best = m; bestDist = d; }
  }
  return best;
}

function updateCaltropMeshes(view) {
  const live = new Set();
  for (const c of view.caltrops ?? []) {
    live.add(c.id);
    let mesh = caltropMeshes.get(c.id);
    if (!mesh) {
      mesh = buildProcedural("mine");
      mesh.scale.set(0.45, 0.45, 0.45); // smaller than ordnance — litter, not a bomb
      scene.add(mesh);
      caltropMeshes.set(c.id, mesh);
    }
    applyTeamColor(mesh, c.team === joined?.team ? "#b8b06a" : "#d8a03a");
    mesh.position.set(c.cellX + 0.5, 0, c.cellY + 0.5);
  }
  for (const [id, mesh] of caltropMeshes) {
    if (!live.has(id)) { scene.remove(mesh); caltropMeshes.delete(id); }
  }
}

function updateSandbagMeshes(view) {
  const live = new Set();
  for (const sb of view.sandbags ?? []) {
    live.add(sb.id);
    let mesh = sandbagMeshes.get(sb.id);
    if (!mesh) {
      mesh = buildProcedural("mine"); // squat proxy silhouette (art pass later)
      scene.add(mesh);
      sandbagMeshes.set(sb.id, mesh);
    }
    const building = sb.buildTicks > 0;
    mesh.scale.set(0.9, building ? 0.25 : 0.55, 0.9);
    applyTeamColor(mesh, sb.team === joined?.team ? "#9a8f6a" : "#8a6f4a");
    mesh.position.set(sb.cellX + 0.5, 0, sb.cellY + 0.5);
  }
  for (const [id, mesh] of sandbagMeshes) {
    if (!live.has(id)) { scene.remove(mesh); sandbagMeshes.delete(id); }
  }
}

function updateMineMeshes(view) {
  const live = new Set();
  for (const m of view.mines ?? []) {
    live.add(m.id);
    let mesh = mineMeshes.get(m.id);
    if (!mesh) {
      mesh = buildProcedural("mine"); // 11Q: factory model
      scene.add(mesh);
      mineMeshes.set(m.id, mesh);
    }
    // Own mines read as ordnance (team-panel tinted); marked enemy mines
    // scream danger (red panel).
    const own = m.team === joined?.team;
    applyTeamColor(mesh, own
      ? teamToken(ASSET_TOKENS, m.team).color
      : "#d03a2a");
    mesh.position.set(m.cellX + 0.5, 0, m.cellY + 0.5);
  }
  for (const [id, mesh] of mineMeshes) {
    if (!live.has(id)) {
      scene.remove(mesh);
      mineMeshes.delete(id);
    }
  }
}

function updateDroneMeshes(view, nowMs) {
  const live = new Set();
  for (const d of view.drones ?? []) {
    live.add(d.id);
    let mesh = droneMeshes.get(d.id);
    if (!mesh) {
      mesh = buildProcedural("drone"); // 11Q: factory quad
      applyTeamColor(mesh, teamToken(ASSET_TOKENS, d.team).color);
      // 14C: rotor blur disc — a faint spinning shadow that sells flight.
      const rotor = new THREE.Mesh(
        new THREE.CircleGeometry(0.26, 14),
        new THREE.MeshBasicMaterial({
          color: 0x1c1c1c, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
        }));
      rotor.rotation.x = -Math.PI / 2;
      rotor.position.y = 0.14;
      rotor.name = "rotorDisc";
      mesh.add(rotor);
      scene.add(mesh);
      droneMeshes.set(d.id, mesh);
    }
    mesh.position.set(d.x / CELL + 0.5, 1.1, d.y / CELL + 0.5);
    mesh.rotation.y = (nowMs % 2000) / 2000 * Math.PI * 2; // slow menace spin
  }
  for (const [id, mesh] of droneMeshes) {
    if (!live.has(id)) {
      scene.remove(mesh);
      droneMeshes.delete(id);
    }
  }
}

// 11O: in direct mode a targeting circle rides the asset — your gun's
// true reach, always visible while you drive.
// 11U: the one-action banner — DOWN countdown/redeploy, or the tow
// prompt. Clicking it performs the action; the key shortcut still works.
let bannerAction = null;
function updateActionBanner(view) {
  const el = document.getElementById("action-banner");
  if (!el || !joined || joined.spectator) return;
  let text = null;
  bannerAction = null;
  // Prompt-100: the station banner — what you man, how to fire, how to
  // leave. AT gunners see their missile count.
  const myStation = view?.friendlyAssets?.find(
    (a) => a.stationOp === joined.operatorId && a.state !== STATE_DISABLED && a.state !== 3);
  if (myStation) {
    const st = getUnitStats(myStation.type).station;
    const el2 = document.getElementById("action-banner");
    if (el2) {
      const text = st.kind === "mg"
        ? t("banner.station_mg", { key: BINDS.station.toUpperCase() })
        : t("banner.station_at", { n: myStation.stationAmmo, key: BINDS.station.toUpperCase() });
      if (el2.textContent !== text) el2.textContent = text;
      el2.style.display = "block";
      el2.style.color = "#9fe89f";
      bannerAction = () => send({ type: "leave_station" });
    }
    return;
  }
  const myDown = view?.downedOperators?.find((d) => d.operatorId === joined.operatorId);
  if (myDown) {
    // B7: the death recap rides the down banner — what got you, and
    // from where, while you decide what to do about it.
    const recap = deathRecap ? `${deathRecapLine(deathRecap)} · ` : "";
    const wait = Math.ceil((100 - (myDown.downTicks ?? 0)) / 10);
    if (wait > 0) {
      text = recap + t("banner.down_wait", { s: wait });
    } else {
      // 15F: a crewed friendly carrier with a free bunk beats the walk
      // home — clicking spawns you ABOARD (30 s cooldown server-side).
      const spawnable = (view?.friendlyAssets ?? []).find((a) =>
        a.type === 4 && a.operatorId !== -1 && a.operatorId !== joined.operatorId &&
        a.state !== STATE_DISABLED && a.state !== 3 &&
        (a.aboard1 === -1 || a.aboard2 === -1));
      if (spawnable) {
        text = recap + t("banner.spawn_carrier", { id: spawnable.id });
        bannerAction = () => send({ type: "redeploy", carrierAssetId: spawnable.id });
      } else {
        text = recap + t("banner.down_ready");
        bannerAction = () => send({ type: "redeploy" });
      }
    }
  } else {
    deathRecap = null; // B7: back on my feet (or in a hull) — recap done
    const wreck = adjacentTowableWreck(view);
    const me = view?.friendlyAssets?.find((a) => a.operatorId === joined.operatorId);
    if (wreck) {
      text = t("banner.tow", { id: wreck.id });
      bannerAction = () => send({ type: "tow_order", wreckAssetId: wreck.id });
    } else if (me?.type === 3 && adjacentNeedyFriendly(view)) { // 13A
      const needy = adjacentNeedyFriendly(view);
      text = t("banner.resupply", { id: needy.id });
      bannerAction = () => send({ type: "transfer_cargo", targetAssetId: needy.id });
    } else if (me?.type === 7 && me.deployTimer === 0) { // 12B
      text = me.deployed === 1 ? t("banner.undeploy") : t("banner.deploy");
      bannerAction = () => send({ type: me.deployed === 1 ? "undeploy" : "deploy_hardpoint" });
    }
    // 15: tactically stuck? The status panel's force-respawn button calls
    // CMD_RESPAWN; while the 10 s countdown runs the banner narrates it.
    const myOp = view?.operators?.find((o) => o.id === joined.operatorId);
    if (!text && (myOp?.respawnTicks ?? 0) > 0) {
      text = t("banner.respawning", { s: Math.ceil(myOp.respawnTicks / 10) });
    }
  }
  if (text) {
    if (el.textContent !== text) el.textContent = text;
    el.style.display = "block";
    el.style.color = bannerAction ? "#9fe89f" : "#ffd75e";
  } else {
    el.style.display = "none";
  }
}

// 13A: the neediest adjacent friendly, if I drive a stocked truck.
function adjacentNeedyFriendly(view) {
  const me = view?.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId);
  if (!me || me.type !== 3 || (me.cargoFuel <= 0 && me.cargoAmmo <= 0)) return null;
  return (view?.friendlyAssets ?? []).find((a) =>
    a.id !== me.id && a.state !== STATE_DISABLED && a.state !== 3 &&
    (a.ammo < 12 || a.fuel < 2400) && (a.ammo <= 6 || a.fuel <= 1200) &&
    Math.max(Math.abs(Math.floor(a.x / CELL) - Math.floor(me.x / CELL)),
             Math.abs(Math.floor(a.y / CELL) - Math.floor(me.y / CELL))) <= 1) ?? null;
}

// 11U: the claimable friendly wreck beside my truck, if I drive one.
function adjacentTowableWreck(view) {
  const me = view?.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId);
  if (!me || me.type !== 3) return null;
  const towingAlready = (view?.friendlyAssets ?? []).some((a) => a.towedBy === me.id);
  if (towingAlready) return null;
  return (view?.friendlyAssets ?? []).find((a) =>
    (a.state === STATE_DISABLED || a.state === 3) &&
    a.towedBy === -1 && a.recoverTimer === 0 && a.id !== me.id &&
    Math.max(Math.abs(Math.floor(a.x / CELL) - Math.floor(me.x / CELL)),
             Math.abs(Math.floor(a.y / CELL) - Math.floor(me.y / CELL))) <= 1) ?? null;
}

// 11T public tasks (plan 2.4): top mission cards from the pure model.
// Clicking a card jumps the camera there and sends the matching context
// ping — that IS "responding" on the team channel for v2.0.
let lastTaskKey = "";
function updateTaskStrip(view) {
  const el = document.getElementById("task-strip");
  if (!el) return;
  if (joined?.spectator || !joined) {
    if (lastTaskKey !== "") { el.innerHTML = ""; lastTaskKey = ""; }
    return;
  }
  const tasks = tasksFor(view, joined.operatorId).slice(0, 5); // 14J: five
  const key = tasks.map((t) => t.id + (t.mine ? "*" : "")).join("|");
  if (key === lastTaskKey) return;
  lastTaskKey = key;
  el.innerHTML = "";
  for (const t of tasks) {
    const card = document.createElement("div");
    card.textContent = t.label;
    card.style.cssText =
      "background:rgba(10,14,10,0.78); color:#d8e6c8; padding:7px 10px;" +
      `border-left:3px solid ${t.mine ? "#57c46b" : "#f5e96b"}; border-radius:4px;` +
      "font:12px sans-serif; cursor:pointer;";
    card.onclick = () => {
      freeCam.jumpTo(t.cellX, t.cellY);
      send({ type: "ping", kind: t.ping, targetCellX: t.cellX, targetCellY: t.cellY });
    };
    el.appendChild(card);
  }
}

// Playtest-8: the NOTICE line — one prominent, short-lived message for
// things the player must actually notice: why an action was refused
// (item 30), the weather turning (26), and the war clock (27). Distinct
// from the mission toast (reward) and the action banner (a thing to do).
let noticeUntil = 0;
function flashNotice(text, ms = 2600, color = "#ffd75e") {
  const el = document.getElementById("centre-notice");
  if (!el) return;
  el.textContent = text;
  el.style.color = color;
  el.style.display = "block";
  el.style.opacity = "1";
  noticeUntil = performance.now() + ms;
}
function updateCentreNotice() {
  if (noticeUntil === 0) return; // idle: no DOM work at all, every frame
  const el = document.getElementById("centre-notice");
  if (!el) return;
  const left = noticeUntil - performance.now();
  if (left <= 0) { el.style.display = "none"; noticeUntil = 0; }
  else el.style.opacity = String(Math.min(1, left / 700));
}

// Item 27: the war clock, announced. Fires once per threshold per war —
// half time, 25% left, 10% left, then a countdown over the last 30 s.
let clockMarks = new Set();
let lastCountdownSecond = -1;
function updateWarClock(view) {
  if (!view || view.phase !== 0) return;
  const left = TIME_LIMIT_TICKS - view.tick;
  if (left <= 0) return;
  const secs = Math.ceil(left / 10); // 10 Hz
  for (const [frac, key] of [[0.5, "clock.half"], [0.25, "clock.quarter"], [0.1, "clock.tenth"]]) {
    if (!clockMarks.has(key) && left <= TIME_LIMIT_TICKS * frac) {
      clockMarks.add(key);
      flashNotice(t(key, { m: Math.round(left / 600) }), 3000);
    }
  }
  if (secs <= 30 && secs !== lastCountdownSecond) {
    lastCountdownSecond = secs;
    flashNotice(t("clock.countdown", { s: secs }), 1100, secs <= 10 ? "#ff6b52" : "#ffd75e");
  }
}

// 14J (playtest 6.5): Recognition made LOUD — your score rising IS a
// mission completing; toast it center screen with the points.
function updateMissionToast(view) {
  const el = document.getElementById("mission-toast");
  if (!el || joined?.spectator) return;
  const mine = (view?.operators ?? []).find((o) => o.id === joined?.operatorId);
  if (mine) {
    if (lastMyScore !== null && mine.score > lastMyScore) {
      el.textContent = t("toast.mission", { n: mine.score - lastMyScore });
      el.style.display = "block";
      toastUntil = performance.now() + 2600;
    }
    lastMyScore = mine.score;
  }
  if (el.style.display === "block") {
    const left = toastUntil - performance.now();
    if (left <= 0) el.style.display = "none";
    else el.style.opacity = String(Math.min(1, left / 800));
  }
}

// 14J (playtest 6.5): the collapsible team top-5, left side.
let boardKey = "";
function updateTeamBoard(view) {
  const head = document.getElementById("team-board-head");
  const body = document.getElementById("team-board-body");
  if (!head || !body || !joined || joined.spectator) return;
  const top = (view?.operators ?? [])
    .filter((o) => o.team === joined.team && o.score > 0)
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, 5);
  const key = boardCollapsed + "|" + top.map((o) => `${o.id}:${o.score}`).join(",");
  if (key === boardKey) return;
  boardKey = key;
  head.textContent = `${t("board.title")} ${boardCollapsed ? "▸" : "▾"}`;
  head.onclick = () => {
    boardCollapsed = !boardCollapsed;
    localStorage.setItem("mf_board_collapsed", boardCollapsed ? "1" : "0");
    boardKey = "";
  };
  body.innerHTML = boardCollapsed ? "" : top.map((o) =>
    `<div${o.id === joined.operatorId ? ' style="color:#f5e96b;"' : ""}>` +
    `${o.id < 16 ? "Op" : "Regent"} ${o.id} — ${o.score}</div>`).join("") ||
    (boardCollapsed ? "" : "<div style='color:#667'>—</div>");
}

// 14J (playtest 6.9): golden rings on nearby applicable mission targets.
const targetRings = new Map(); // task id -> mesh
function updateTargetRings(view) {
  const live = new Set();
  if (joined && !joined.spectator) {
    const tasks = tasksFor(view, joined.operatorId).slice(0, 5);
    for (const task of tasks) {
      // Dropoff cards (item 18) ring their DESTINATION at any distance;
      // other cards ring only when you close within 15 cells.
      if (!task.dropoff && (task.distance > 15 || task.mine)) continue;
      live.add(task.id);
      let ring = targetRings.get(task.id);
      if (!ring) {
        ring = new THREE.Mesh(
          new THREE.RingGeometry(0.85, 1.05, 40),
          new THREE.MeshBasicMaterial({ color: 0xf5c84a, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        scene.add(ring);
        targetRings.set(task.id, ring);
      }
      ring.position.set(task.cellX + 0.5, 0.06, task.cellY + 0.5);
      const pulse = 1 + 0.12 * Math.sin(performance.now() / 260);
      ring.scale.set(pulse, pulse, 1);
    }
  }
  for (const [id, ring] of targetRings) {
    if (!live.has(id)) {
      scene.remove(ring);
      targetRings.delete(id);
    }
  }
}

// 14I: the lower-center status panel — the "why am I not firing" answers.
let statusKey = "";
function updateStatusPanel(view) {
  const el = document.getElementById("status-panel");
  if (!el) return;
  const me = view?.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId);
  if (!me || joined?.spectator) {
    if (statusKey !== "") { el.style.display = "none"; statusKey = ""; }
    return;
  }
  const s = statusFor(me, { inSupplyNow: isSupplied(view, me) });
  const key = JSON.stringify([s.hp, s.ammo, s.fuel, s.reasons, s.cargo]);
  if (key === statusKey) return;
  statusKey = key;
  el.style.display = "block";
  const bar = (v, max, color) => {
    const pct = Math.max(0, Math.min(100, Math.round((v / max) * 100)));
    return `<span style="display:inline-block; width:70px; background:#222; border-radius:3px; margin:0 4px; vertical-align:middle;">` +
      `<span style="display:block; width:${pct}%; height:7px; background:${color}; border-radius:3px;"></span></span>`;
  };
  let html = `<b>${s.name}</b> · HP ${s.hp}${bar(s.hp, s.hpMax, "#57c46b")}` +
    `AMMO ${s.ammo}${bar(s.ammo, s.ammoMax, "#f5e96b")}` +
    `FUEL ${s.fuel}${bar(s.fuel, s.fuelMax, "#7fd4ff")}` +
    (s.cargo ? ` · ${t("ui.cargo", { fuel: s.cargo.fuel, ammo: s.cargo.ammo })}` : "");
  const colors = { bad: "#ff6b52", warn: "#f5e96b", info: "#9ab" };
  for (const r of s.reasons) {
    html += `<div style="color:${colors[r.level]}; font-weight:${r.level === "bad" ? "bold" : "normal"};">` +
      `${t(r.key, r.params ?? undefined)}</div>`;
  }
  if (s.canRequestSupplies) {
    html += `<button id="btn-request-supplies" class="btn" style="margin-top:4px; font-size:12px; padding:2px 10px;">${t("status.request")}</button>`;
  }
  html += ` <button id="btn-center-me" class="btn" style="margin-top:4px; font-size:12px; padding:2px 10px;">${t("ui.center_me")}</button>`;
  // 15: the escape hatch for the tactically stuck — abandon in place,
  // 10 s countdown, hull self-recalls in 60 s (double-click to confirm).
  html += ` <button id="btn-force-respawn" class="btn" style="margin-top:4px; font-size:12px; padding:2px 10px; border-color:#a55;">${t("status.force_respawn")}</button>`;
  el.innerHTML = html;
  const btn = document.getElementById("btn-request-supplies");
  if (btn) btn.onclick = () => send({ type: "ping", kind: "need_supplies" });
  const center = document.getElementById("btn-center-me");
  if (center) center.onclick = centreOnMe; // 14J item 8; playtest-8 item 29
  const fr = document.getElementById("btn-force-respawn");
  if (fr) fr.ondblclick = () => send({ type: "respawn" });
}

// Supply truth the client can know: within 20 cells of an own base rect
// or 12 of an owned relay (mirrors engine/supply.js for display only).
function isSupplied(view, me) {
  const cx = Math.floor(me.x / CELL);
  const cy = Math.floor(me.y / CELL);
  for (const b of view?.bases ?? []) {
    if (b.team !== joined?.team) continue;
    const dx = Math.max(b.x - cx, 0, cx - (b.x + b.width - 1));
    const dy = Math.max(b.y - cy, 0, cy - (b.y + b.height - 1));
    if (Math.max(dx, dy) <= 20) return true;
  }
  for (const sIte of view?.sites ?? []) {
    if (sIte.owner !== joined?.team || sIte.hp === 0) continue;
    if (Math.max(Math.abs(sIte.cellX - cx), Math.abs(sIte.cellY - cy)) <= 12) return true;
  }
  return false;
}

// 14I: hover a vacant friendly — name tag + the stats shortcut.
let hoverAssetId = null;
let lastHoverMs = 0;
function updateHoverTip(view) {
  const el = document.getElementById("hover-tip");
  if (!el || hoverAssetId === null) { if (el) el.style.display = "none"; return; }
  // Item 33: hovering a visible ENEMY answers "can I actually shoot
  // that?" before you waste a click. Uses the same range model the
  // targeting ring draws, so the tip and the ring can never disagree —
  // including the DEAD ZONE that indirect tubes have.
  const foe = (view?.visibleEnemies ?? []).find((x) => x.id === hoverAssetId);
  // Playtest-10 item 37: a WRECK is not a target — fire_order refuses
  // them — so "out of range" over one is noise. No tip at all.
  if (foe && (foe.state === STATE_DISABLED || foe.state === 3)) {
    el.style.display = "none";
    return;
  }
  if (foe) {
    const ring = weaponRangeOverlay(view, joined?.operatorId);
    if (!ring) { el.style.display = "none"; return; }
    const dx = foe.x / CELL - (ring.centerX - 0.5);
    const dy = foe.y / CELL - (ring.centerY - 0.5);
    const dist = Math.hypot(dx, dy);
    const tooFar = dist > ring.radiusCells;
    const tooClose = ring.minRadiusCells > 0 && dist < ring.minRadiusCells;
    const pos = new THREE.Vector3(foe.x / CELL + 0.5, 1.2, foe.y / CELL + 0.5).project(camera);
    el.style.left = `${Math.round((pos.x * 0.5 + 0.5) * window.innerWidth - 60)}px`;
    el.style.top = `${Math.round((-pos.y * 0.5 + 0.5) * window.innerHeight - 46)}px`;
    el.style.display = "block";
    const label = tooFar ? t("hover.out_of_range")
      : tooClose ? t("hover.too_close")
      : t("hover.in_range");
    const colour = tooFar || tooClose ? "#ff6b52" : "#57c46b";
    el.innerHTML = `<span style="color:${colour}; font-weight:bold;">${label}</span>` +
      `<span style="color:#9ab;"> ${Math.round(dist)}c</span>`;
    return;
  }
  const a = view?.friendlyAssets?.find((x) => x.id === hoverAssetId);
  const operable = a && a.state !== STATE_DISABLED && a.state !== 3;
  // Prompt-100: a VACANT STATION on any operable friendly is worth a
  // tip of its own, even when a driver is aboard.
  const stationStats = operable ? getUnitStats(a.type).station : null;
  const stationOpen = stationStats && a.stationOp === -1;
  if (!a || !operable || (a.operatorId !== -1 && !stationOpen)) {
    el.style.display = "none";
    return;
  }
  const pos = new THREE.Vector3(a.x / CELL + 0.5, 1.2, a.y / CELL + 0.5).project(camera);
  const sx = (pos.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-pos.y * 0.5 + 0.5) * window.innerHeight;
  el.style.left = `${Math.round(sx - 60)}px`;
  el.style.top = `${Math.round(sy - 46)}px`;
  el.style.display = "block";
  const name = codexFor(a.type)?.name?.toUpperCase() ?? "UNIT";
  const stationLine = stationOpen
    ? ` <span style="color:#9fe89f;">${t(stationStats.kind === "mg" ? "hover.join_mg" : "hover.join_at")}</span>`
    : "";
  if (a.operatorId !== -1) {
    // Crewed hull, open station: the tip is ONLY the join line.
    el.innerHTML = stationLine;
    return;
  }
  // Item 31: the key is the reliable route — the link stays for mouse
  // users who manage to reach it, but the tip now names the shortcut.
  el.innerHTML = `${t("hover.vacant", { name })} ` +
    `<span id="hover-stats" style="color:#7fd4ff; cursor:pointer;">${t("hover.stats")}</span>` +
    ` <span style="color:#9ab;">(${BINDS.stats.toUpperCase()})</span>` + stationLine;
  const link = document.getElementById("hover-stats");
  if (link) link.onclick = (ev) => { ev.stopPropagation(); showCodex(a.type); };
}

// 14I: the inline stats panel — seed of the encyclopedia.
function showCodex(type) {
  const el = document.getElementById("codex-panel");
  const c = codexFor(type);
  if (!el || !c) return;
  el.style.display = "block";
  el.innerHTML = `<b style="font-size:14px;">${c.name.toUpperCase()}</b>` +
    `<div style="color:#9ab; margin:4px 0;">${c.role}</div>` +
    c.lines.map(([k, v]) => `<div>${k}: <b>${v}</b></div>`).join("") +
    (c.traits.length
      ? `<div style="margin-top:4px; color:#f5e96b;">${t("codex.traits")}: ${c.traits.join(" · ")}</div>`
      : "") +
    `<div style="margin-top:6px; text-align:right;"><span id="codex-close" style="cursor:pointer; color:#7fd4ff;">×</span></div>`;
  document.getElementById("codex-close").onclick = () => { el.style.display = "none"; };
}

// 14J' (prompt 39): order confirms are LOW-POLY GROUND MARKERS in the
// game's own art language — flat meshes that shrink into place and fade,
// never billboarded sprites.
function flatMat(colorHex) {
  return new THREE.MeshBasicMaterial({
    color: colorHex, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
  });
}
function makeOrderMarker(kind) {
  const g = new THREE.Group();
  if (kind === "move" || kind === "crawl") {
    // A gold road chevron: two blades meeting at the tip, pointing +z.
    const color = kind === "move" ? 0xf5c84a : 0xffd75e;
    // Playtest-8 item 23: the blades used to splay the WRONG way — they
    // met at -z while the tip cone pointed +z, and since the blades are
    // much larger than the cone the whole marker read as pointing
    // backwards. (Reported twice; a code-read cleared it wrongly the
    // first time because the rotation MATH was right — the geometry was
    // not.) Apex now agrees with the tip.
    for (const side of [-1, 1]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.12), flatMat(color));
      blade.position.set(side * 0.16, 0.05, -0.1);
      blade.rotation.y = side * Math.PI / 4;
      g.add(blade);
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 3), flatMat(color));
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0.05, 0.18);
    g.add(tip);
  } else if (kind === "fire") {
    // A red reticle: four wedges biting inward + a center diamond.
    for (let i = 0; i < 4; i++) {
      const wedge = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 3), flatMat(0xd8452e));
      wedge.rotation.x = Math.PI / 2;
      const a = (i / 4) * Math.PI * 2;
      wedge.position.set(Math.sin(a) * 0.55, 0.05, Math.cos(a) * 0.55);
      wedge.rotation.y = -a + Math.PI; // point inward
      g.add(wedge);
    }
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.14), flatMat(0xd8452e));
    core.rotation.y = Math.PI / 4;
    core.position.y = 0.05;
    g.add(core);
  } else if (kind === "tow") {
    // A cyan recovery clamp: two prongs and a crossbar.
    for (const side of [-1, 1]) {
      const prong = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.5), flatMat(0x5ec4e8));
      prong.position.set(side * 0.3, 0.05, 0.05);
      g.add(prong);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.1), flatMat(0x5ec4e8));
    bar.position.set(0, 0.05, -0.22);
    g.add(bar);
  } else { // select/take: a green field diamond.
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 4), flatMat(0x57c46b));
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.z = Math.PI / 4;
    ring.position.y = 0.05;
    g.add(ring);
  }
  return g;
}
const ORDER_KIND = {
  move_order: "move", crawl_order: "crawl", fire_order: "fire",
  tow_order: "tow", select_asset: "select",
};
function spawnOrderMarker(cmd, cellX, cellY) {
  const kind = ORDER_KIND[cmd.type];
  if (!kind) return;
  const marker = makeOrderMarker(kind);
  marker.position.set(cellX + 0.5, 0, cellY + 0.5);
  // Movement chevrons point along the travel direction. Item 23 asks for
  // "at all time", so the aim is refreshed every frame while the marker
  // lives (you turn, the chevron keeps pointing the way you travel) —
  // and it works while DOWNED too, where the mover is a crawling
  // operator rather than an asset.
  const aimed = kind === "move" || kind === "crawl";
  if (aimed) aimOrderMarker(marker, cellX, cellY);
  scene.add(marker);
  orderMarkers.push({ marker, bornMs: performance.now(), aimed, cellX, cellY });
}

function aimOrderMarker(marker, cellX, cellY) {
  const me = whereAmI(interpolator.latest());
  if (!me) return;
  const dx = cellX + 0.5 - me.x / CELL;
  const dz = cellY + 0.5 - me.y / CELL;
  if (dx === 0 && dz === 0) return;
  // The marker's nose is +z; rotation.y = atan2(dx, dz) turns +z onto
  // the travel vector.
  marker.rotation.y = Math.atan2(dx, dz);
}
function updateOrderMarkers(nowMs) {
  for (let i = orderMarkers.length - 1; i >= 0; i--) {
    const m = orderMarkers[i];
    const age = nowMs - m.bornMs;
    if (age > 1100) {
      scene.remove(m.marker);
      orderMarkers.splice(i, 1);
      continue;
    }
    if (m.aimed) aimOrderMarker(m.marker, m.cellX, m.cellY); // item 23
    // RTS confirm: shrink into place fast, then fade out flat.
    const settle = Math.min(1, age / 180);
    const size = 1.6 - 0.6 * settle;
    m.marker.scale.set(size, 1, size);
    const fade = age < 500 ? 1 : 1 - (age - 500) / 600;
    m.marker.traverse((n) => { if (n.isMesh) n.material.opacity = 0.95 * fade; });
  }
}

function updateDirectRing(view) {
  const own = directMode
    ? view?.friendlyAssets?.find((a) => a.operatorId === joined?.operatorId)
    : null;
  const range = own ? weaponRangeOverlay(view, joined.operatorId) : null;
  if (!range) {
    if (directRing) { scene.remove(directRing); directRing = null; }
    return;
  }
  if (!directRing) {
    directRing = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff5533, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    });
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(range.radiusCells - 0.18, range.radiusCells, 64), mat);
    outer.rotation.x = -Math.PI / 2;
    outer.name = "outer";
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 24), mat);
    inner.rotation.x = -Math.PI / 2;
    directRing.add(outer, inner);
    scene.add(directRing);
  }
  directRing.position.set(range.centerX, 0.07, range.centerY);
}

function updatePingLabels(view) {
  const alive = activePings(teamPings, view.tick ?? 0);
  teamPings.length = 0;
  teamPings.push(...alive);
  const live = new Set();
  for (const p of alive) {
    const key = `ping${p.operatorId}`;
    live.add(key);
    upsertWorldLabel(key, `◈ ${(p.kind ?? "").replace(/_/g, " ").toUpperCase()}`,
      "#7fd4ff", p.cellX + 0.5, 1.6, p.cellY + 0.5);
  }
  for (const [key, label] of worldLabels) {
    if (key.startsWith("ping") && !live.has(key)) {
      scene.remove(label.sprite);
      worldLabels.delete(key);
    }
  }
}

// 13E fog ghosts: translucent last-seen hulls, fading over 10 s.
function updateGhostMeshes(nowMs) {
  const live = new Set();
  for (const g of fogGhosts) {
    const alpha = ghostOpacity(g, nowMs);
    if (alpha <= 0) continue;
    live.add(g.id);
    let mesh = ghostMeshes.get(g.id);
    if (!mesh) {
      const resolved = resolveVisual(ASSET_MANIFEST, visualKeyFor(g));
      mesh = buildProcedural(resolved.key ?? "tank") ?? buildProcedural("tank");
      mesh.traverse((n) => {
        if (n.isMesh) {
          n.material = n.material.clone();
          n.material.transparent = true;
          n.material.color.set(0x9fb4c8); // spectral, faction-less memory
        }
      });
      scene.add(mesh);
      ghostMeshes.set(g.id, mesh);
    }
    mesh.position.set(g.x / CELL + 0.5, 0, g.y / CELL + 0.5);
    mesh.rotation.y = Math.PI / 2 - ((g.heading ?? 0) * Math.PI * 2) / 256;
    mesh.traverse((n) => { if (n.isMesh) n.material.opacity = alpha * 0.45; });
  }
  for (const [id, mesh] of ghostMeshes) {
    if (!live.has(id)) {
      scene.remove(mesh);
      ghostMeshes.delete(id);
    }
  }
}

// FIGURE KIT: the compounds get people — one watchman per prison
// (alarm lamp pulses after a prison_alarm ping) and a kneeling figure
// per held POW. Pure presentation from public view data.
function updatePrisonFigures(view) {
  const live = new Set();
  for (const p of view.prisons ?? []) {
    const gKey = `g${p.team}`;
    live.add(gKey);
    let guard = prisonFigures.get(gKey);
    if (!guard) {
      guard = buildProcedural("guard");
      scene.add(guard);
      prisonFigures.set(gKey, guard);
    }
    guard.position.set(p.cellX + 0.9, 0, p.cellY + 0.5);
    const lamp = guard.getObjectByName("alarm_lamp");
    if (lamp) {
      const flashing = Date.now() < alarmFlashUntil;
      lamp.material.color.set(flashing && (Date.now() % 500) < 250 ? "#ff4a3a" : "#3a2f2a");
    }
    const n = p.pows ?? p.powCount ?? 0;
    const count = Array.isArray(n) ? n.length : n;
    for (let i = 0; i < count && i < 6; i++) {
      const key = `p${p.team}-${i}`;
      live.add(key);
      let fig = prisonFigures.get(key);
      if (!fig) {
        fig = buildProcedural("pow_figure");
        scene.add(fig);
        prisonFigures.set(key, fig);
      }
      fig.position.set(p.cellX + 0.25 + (i % 3) * 0.28, 0, p.cellY + 0.25 + ((i / 3) | 0) * 0.4);
    }
  }
  for (const [key, mesh] of prisonFigures) {
    if (!live.has(key)) { scene.remove(mesh); prisonFigures.delete(key); }
  }
}

function updateDownedMeshes(view) {
  const live = new Set();
  for (const d of view.downedOperators ?? []) {
    live.add(d.operatorId);
    let mesh = downedMeshes.get(d.operatorId);
    if (!mesh) {
      mesh = buildProcedural("operator_down");
      applyTeamColor(mesh, teamToken(ASSET_TOKENS, joined?.team ?? 0).color);
      scene.add(mesh);
      downedMeshes.set(d.operatorId, mesh);
    }
    mesh.position.set(d.x / CELL + 0.5, 0.05, d.y / CELL + 0.5);
    // Figure kit: a FREED POW reads distinct — pale coat, not team paint
    // (they are barely walking; the carrier ride is the rescue).
    if (d.freedPow === 1 && !mesh.userData.freedTint) {
      applyTeamColor(mesh, "#cfc7a8");
      mesh.userData.freedTint = true;
    }
    const mine = d.operatorId === joined?.operatorId;
    const canBoard = mine && adjacentBoardableCarrier(view);
    upsertWorldLabel(`down${d.operatorId}`,
      mine
        ? (canBoard ? t("label.board_here") : t("label.you_down"))
        : t("label.operator_down"),
      "#ffd75e", d.x / CELL + 0.5, 1.2, d.y / CELL + 0.5);
  }
  for (const [id, mesh] of downedMeshes) {
    if (!live.has(id)) {
      scene.remove(mesh);
      downedMeshes.delete(id);
      const label = worldLabels.get(`down${id}`);
      if (label) { scene.remove(label.sprite); worldLabels.delete(`down${id}`); }
    }
  }
}

// 14J: does a footprint touch road (1) or trail (5)? Those stay clear.
function coversProtectedTerrain(x, y, half) {
  if (!cachedMap) return false;
  for (const cx of [Math.floor(x - half), Math.floor(x + half)]) {
    for (const cy of [Math.floor(y - half), Math.floor(y + half)]) {
      const terrain = cachedMap.cells[cy * cachedMap.width + cx];
      if (terrain === 1 || terrain === 5) return true;
    }
  }
  return false;
}

// 14A: one-time war dressing — antenna clutter at relays, plinths at the
// standard homes. Rebuilt when the war (terrain) changes.
let dressingGroup = null;
let dressingKey = "";
function updateWarDressing(view) {
  const key = `${cachedMap?.profile ?? ""}:${(view.sites ?? []).map((s) => s.id).join(",")}` +
    `:${(view.standards ?? []).map((st) => `${st.homeCellX},${st.homeCellY}`).join("|")}`;
  if (key === dressingKey) return;
  dressingKey = key;
  if (dressingGroup) scene.remove(dressingGroup);
  dressingGroup = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x2e2e38 });
  const pale = new THREE.MeshLambertMaterial({ color: 0x8a8a72 });
  for (const s of view.sites ?? []) {
    for (const [dx, dz, w, h] of [[-0.9, 0.4, 0.25, 0.35], [0.8, -0.6, 0.3, 0.2], [0.7, 0.7, 0.2, 0.5]]) {
      // 14J: relay clutter respects the road too.
      if (coversProtectedTerrain(s.cellX + 0.5 + dx, s.cellY + 0.5 + dz, w / 2 + 0.1)) continue;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), dark);
      crate.position.set(s.cellX + 0.5 + dx, h / 2, s.cellY + 0.5 + dz);
      dressingGroup.add(crate);
    }
  }
  for (const st of view.standards ?? []) {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 0.12, 8), pale);
    plinth.position.set(st.homeCellX + 0.5, 0.06, st.homeCellY + 0.5);
    dressingGroup.add(plinth);
  }
  // 14G: base compounds — each headquarters becomes a real place. All
  // presentation: deterministic layout mirrored so both HQs face the front.
  const BUILDING = {
    hq: { geo: () => new THREE.BoxGeometry(2.4, 1.3, 1.6), y: 0.65 },
    shed: { geo: () => new THREE.BoxGeometry(1.6, 0.8, 1.1), y: 0.4 },
    tank_fuel: { geo: () => new THREE.CylinderGeometry(0.45, 0.45, 1.1, 8), y: 0.55 },
    mast: { geo: () => new THREE.CylinderGeometry(0.06, 0.1, 2.6, 5), y: 1.3 },
    pad: { geo: () => new THREE.CylinderGeometry(1.1, 1.1, 0.06, 10), y: 0.03 },
    post: { geo: () => new THREE.BoxGeometry(0.18, 0.7, 0.18), y: 0.35 },
    // Item 13: the supply depot — long warehouse + crate stacks.
    warehouse: { geo: () => new THREE.BoxGeometry(2.8, 1.0, 1.4), y: 0.5 },
    crates: { geo: () => new THREE.BoxGeometry(0.7, 0.5, 0.7), y: 0.25 },
  };
  for (const b of view.bases ?? []) {
    const faction = factionFor(b.team);
    const wall = new THREE.MeshLambertMaterial({
      color: new THREE.Color(faction.colors.primary).multiplyScalar(0.55),
    });
    const roof = new THREE.MeshLambertMaterial({
      color: new THREE.Color(faction.colors.secondary).multiplyScalar(0.7),
    });
    for (const piece of baseCompound(b, b.team === 1)) {
      const spec = BUILDING[piece.kind];
      if (!spec) continue;
      // 14J (playtest 6.6): roads are sacred — no structure may cover a
      // road or path cell (approximate 2-cell footprint check).
      if (coversProtectedTerrain(piece.x, piece.y, piece.kind === "hq" ? 1.4 : 0.9)) continue;
      const mesh = new THREE.Mesh(spec.geo(), piece.kind === "hq" || piece.kind === "shed" ? wall : roof);
      mesh.position.set(piece.x, spec.y, piece.y);
      mesh.rotation.y = piece.rotation;
      dressingGroup.add(mesh);
      if (piece.kind === "hq") { // a roof cap in the faction identity color
        const cap = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 1.7), roof);
        cap.position.set(piece.x, 1.36, piece.y);
        dressingGroup.add(cap);
      }
    }
  }
  scene.add(dressingGroup);
}

function upsertSiteMesh(site) {
  let mesh = siteMeshes.get(site.id);
  if (!mesh) {
    const resolved = resolveVisual(ASSET_MANIFEST, "relay_site");
    mesh = buildProcedural(resolved.key ?? "relay");
    scene.add(mesh);
    siteMeshes.set(site.id, mesh);
  }
  const color = site.owner === -1
    ? "#888888" : teamToken(ASSET_TOKENS, site.owner).color;
  applyTeamColor(mesh, site.hp === 0 ? "#3a3028" : color); // 11F: ruins go dark
  mesh.scale.y = site.hp === 0 ? 0.45 : 1; // visibly knocked down
  mesh.position.set(site.cellX + 0.5, 0, site.cellY + 0.5);
}

function renderBattlefield() {
  const view = interpolator.sample(performance.now());
  if (!view || !ASSET_TOKENS) return;
  buildTerrain();
  updateSupplyBar(view);
  updateTowCables(view);

  const seen = new Set();
  for (const a of view.friendlyAssets ?? []) {
    seen.add(a.id);
    upsertAssetMesh(a, true);
  }
  const latest = interpolator.latest();
  const diff = diffVisibleEnemies(renderedEnemyIds, latest);
  for (const id of diff.removed) {
    const mesh = assetMeshes.get(id);
    if (mesh) { scene.remove(mesh); assetMeshes.delete(id); }
  }
  renderedEnemyIds = visibleEnemyIds(latest);
  for (const e of view.visibleEnemies ?? []) {
    seen.add(e.id);
    upsertAssetMesh(e, false);
  }
  for (const [id, mesh] of assetMeshes) {
    if (!seen.has(id)) { scene.remove(mesh); assetMeshes.delete(id); }
  }
  for (const site of view.sites ?? []) upsertSiteMesh(site);
  updateWarDressing(view);
  for (const st of view.standards ?? []) upsertStandardMesh(st);
  updateDownedMeshes(view);
  updateMineMeshes(view);
  updateCaltropMeshes(view);
  updateSandbagMeshes(view);
  updatePrisonFigures(view);
  updateDroneMeshes(view, performance.now());
  updatePingLabels(view);
  updateDirectRing(view);
  updateTaskStrip(view);
  updateActionBanner(view);
  fogGhosts = updateGhosts(fogGhosts, view, performance.now());
  updateGhostMeshes(performance.now());
  updateOrderMarkers(performance.now());
  updateStatusPanel(view);
  updateHoverTip(view);
  updateMissionToast(view);
  updateCentreNotice(); // playtest-8: refusals, weather, war clock
  updateTeamBoard(view);
  updateTargetRings(view);
  updateTouchDrive(view);
  updateWorldLabels(view);
  updateOverlays(view);
  updateHealthBars(view);
  updateVfx(performance.now());
  updateMotion(performance.now());
  updateSpawnRing(performance.now(), interpolator.latest());
  updateWeatherVisual(interpolator.latest());
  renderMinimap(interpolator.latest());

  // 8G: follow tracks your asset; manual pan/zoom takes over seamlessly.
  if (joined) {
    // Items 25/29: NO fallback to friendlyAssets[0] — following a random
    // teammate is worse than not following at all.
    const own = whereAmI(view);
    if (own) freeCam.trackIfFollowing(own.x / CELL, own.y / CELL);
  }
  const cam = freeCam.state;
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -cam.zoom * aspect;
  camera.right = cam.zoom * aspect;
  camera.top = cam.zoom;
  camera.bottom = -cam.zoom;
  camera.updateProjectionMatrix();
  camera.position.set(cam.x + 18, 26, cam.y + 18);
  camera.lookAt(cam.x, 0, cam.y);
}

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  const d = 18;
  camera.left = -d * aspect;
  camera.right = d * aspect;
  camera.top = d;
  camera.bottom = -d;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  renderBattlefield();
  renderer.render(scene, camera);
}

// 14D: the 2D sprite fallback — baked rotation sheets on a plain canvas.
// Spectator-grade (orders need the 3D picker); beats a black screen on
// machines without WebGL, and it is the seed of the minimap unit icons.
let sprite2d = null;
function init2dFallback() {
  const container = document.getElementById("canvas-container");
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  const note = document.createElement("div");
  note.style.cssText = "position:absolute;top:8px;left:8px;color:#ddd;font:12px monospace;background:#000a;padding:4px 8px;";
  note.textContent = t("page.fallback2d");
  container.appendChild(note);
  sprite2d = createSpriteRenderer({
    canvas,
    terrainColors: TERRAIN_COLORS.map((c) => `#${c.toString(16).padStart(6, "0")}`),
  });
  sprite2d.load().then(() => {
    connect();
    animate2d();
  });
}

function animate2d() {
  requestAnimationFrame(animate2d);
  // The event handlers keep pushing cues; without the 3D loop nothing
  // prunes them — do it here or the arrays grow for the whole war.
  liveVfx = pruneVfx(liveVfx, performance.now());
  liveMotion = pruneMotion(liveMotion, performance.now());
  sprite2d.draw(interpolator.latest(), cachedMap);
}

init();
