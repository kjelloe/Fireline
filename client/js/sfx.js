// client/js/sfx.js — O1 (prompt 164): the ruled SYNTH-FIRST battlefield
// audio, finally built. Every cue is a tiny WebAudio patch (osc +
// envelope + filtered noise) — no samples, no network, deterministic
// character per kind. One shared context, a master bus with a
// concurrency cap so a barrage never clips into mush.
let ctx = null;
let master = null;
let live = 0;
const MAX_LIVE = 8;

function bus() {
  if (!ctx) {
    ctx = new (window.AudioContext ?? window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function env(node, t0, a, peak, d) {
  node.gain.setValueAtTime(0, t0);
  node.gain.linearRampToValueAtTime(peak, t0 + a);
  node.gain.exponentialRampToValueAtTime(0.001, t0 + a + d);
}

function tone(freq, type, a, peak, d, bend = 1) {
  const c = bus();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (bend !== 1) o.frequency.exponentialRampToValueAtTime(freq * bend, c.currentTime + a + d);
  env(g, c.currentTime, a, peak, d);
  o.connect(g).connect(master);
  o.start();
  o.stop(c.currentTime + a + d + 0.05);
}

function noise(a, peak, d, cutoff = 800) {
  const c = bus();
  const len = Math.ceil(c.sampleRate * (a + d + 0.05));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = cutoff;
  const g = c.createGain();
  env(g, c.currentTime, a, peak, d);
  src.connect(f).connect(g).connect(master);
  src.start();
}

// The patch manifest — kind -> recipe. Character over fidelity.
const PATCHES = {
  fire_gun:   () => { noise(0.004, 0.5, 0.10, 1600); tone(140, "square", 0.004, 0.25, 0.08, 0.5); },
  fire_heavy: () => { noise(0.006, 0.7, 0.22, 700); tone(70, "sine", 0.006, 0.5, 0.25, 0.4); },
  hit:        () => { noise(0.003, 0.35, 0.07, 2400); },
  explode:    () => { noise(0.010, 0.9, 0.6, 500); tone(48, "sine", 0.01, 0.6, 0.55, 0.3); },
  capture:    () => { tone(520, "triangle", 0.01, 0.3, 0.25, 1.5); tone(780, "triangle", 0.12, 0.25, 0.3); },
  respawn:    () => { tone(330, "triangle", 0.01, 0.25, 0.18, 2); },
  ping:       () => { tone(880, "sine", 0.005, 0.2, 0.12); },
  alarm:      () => { tone(620, "square", 0.01, 0.22, 0.16, 0.8); tone(620, "square", 0.22, 0.22, 0.16, 0.8); },
  drone:      () => { tone(240, "sawtooth", 0.02, 0.18, 0.5, 1.6); },
  std_taken:  () => { tone(200, "square", 0.01, 0.3, 0.4, 0.5); },
  std_scored: () => { tone(392, "triangle", 0.01, 0.35, 0.2, 1); tone(523, "triangle", 0.18, 0.35, 0.35, 1); },
  ui:         () => { tone(660, "sine", 0.003, 0.12, 0.05); },
};

export function sfx(kind) {
  if (typeof window === "undefined" || window.__mfSfxOff === true) return;
  const patch = PATCHES[kind];
  if (!patch || live >= MAX_LIVE) return;
  live++;
  try { patch(); } catch { /* audio is a nicety */ }
  setTimeout(() => { live = Math.max(0, live - 1); }, 300);
}
