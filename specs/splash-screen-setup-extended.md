# Fireline Command — Splash Screen Concepts: Detailed Implementation Guide

**Status:** Design reference for local coding ally  
**Scope:** Four approved splash/intro concepts with step-by-step scripts and implementation guidance  
**Constraint:** All concepts must work before WebGL assets are loaded. Use HTML/CSS/SVG/Canvas 2D only.  
**Duration target:** 4–7 seconds first load. 1.5–3 seconds returning player. Skippable on tap/click/Enter once ready.

---

## Shared Rules (All Concepts)

Before reading individual concepts, these rules apply to all four:

### Loading Integration

The splash is tied to real asset loading progress. Do not fake it.

| Loader milestone | Splash may proceed to |
|---|---|
| App boot | Black screen / first frame |
| Manifest loaded | Begin animation |
| Core UI assets ready | Reveal title |
| All assets ready | Reveal menu / fade out |
| Slow connection | Hold on looping title state |

### Skip Behaviour

Once core assets are ready, allow skip via:

- Mouse click / tap
- Enter or Space
- Escape

If assets are not yet ready, skip accelerates the animation to the title hold state but does not show the menu until loading is complete. Show a subtle status line:

```
Preparing the front…
```

### Typography

Use a bold condensed sans-serif or block military-style font.

Recommended web-safe fallback stack:

```css
font-family: "Impact", "Arial Narrow", "Oswald", sans-serif;
letter-spacing: 0.08em;
text-transform: uppercase;
```

Load a custom font only if it is already part of the UI asset bundle.

### Color Tokens

```css
--color-black:        #0a0b0d;
--color-grid:         #1a2a3a;
--color-directorate:  #2a3f5f;   /* slate gray / police blue */
--color-outlier:      #7a3a1a;   /* terracotta */
--color-front-line:   #e8c87a;   /* warm ember / tactical gold */
--color-standard:     #f5e96b;   /* command standard pulse */
--color-title:        #ffffff;
--color-subtitle:     #c8d8e8;
--color-status:       #6a8a9a;
```

### Audio (Optional, Low Priority)

If audio is available:

| Moment | Sound |
|---|---|
| Grid appears | Low hum / static |
| Front line draws | Short radio chirp |
| Standard marker | Soft pulse tone |
| Title reveal | Single low impact hit |
| Menu fade-in | Ambient tactical loop begins |

All audio must be optional and respect system mute/silent mode.

---

## Concept 1: The Front Ignites

### Summary

A tactical map grid fades in. A glowing front line draws across the screen. Faction territories bloom on either side. Unit pips converge. A Command Standard marker pulses. The title reveals.

### Why It Works

- Explains the title visually.
- Communicates the living front and faction conflict.
- Requires no 3D assets.
- Works on mobile.
- Scales from a 4-second fast load to a 10-second slow load gracefully.

### Step-by-Step Script

#### Frame 0.0s — Black

- Background: `--color-black`
- No elements visible.
- Audio: silence or very faint low hum begins.

#### Frame 0.3s — Grid Fades In

- A faint tactical grid appears across the full screen.
- Grid lines: thin, `--color-grid`, opacity 0 → 0.4 over 0.5s.
- Grid spacing: approximately 40–60px on desktop, scales on mobile.
- No labels. Pure geometry.

```css
.grid {
  opacity: 0;
  animation: fadeIn 0.5s ease forwards;
  animation-delay: 0.3s;
}
```

#### Frame 0.8s — Front Line Draws

- A jagged diagonal line draws from left edge to right edge.
- Direction: roughly bottom-left to top-right, or horizontal with slight jag.
- Color: `--color-front-line`, glowing, 2–3px stroke.
- Animation: SVG `stroke-dashoffset` draw from 0% to 100% over 0.8s.
- Audio: short radio chirp.

```svg
<line
  x1="0" y1="55%"
  x2="100%" y2="45%"
  stroke="#e8c87a"
  stroke-width="2.5"
  stroke-dasharray="2000"
  stroke-dashoffset="2000"
  class="front-line"
/>
```

```css
.front-line {
  animation: drawLine 0.8s ease-out forwards;
  animation-delay: 0.8s;
}
@keyframes drawLine {
  to { stroke-dashoffset: 0; }
}
```

#### Frame 1.6s — Territory Blooms

- Below/left of the front line: `--color-directorate` fills in as a semi-transparent wash, opacity 0 → 0.25 over 0.6s.
- Above/right of the front line: `--color-outlier` fills in as a semi-transparent wash, opacity 0 → 0.25 over 0.6s.
- Use SVG clip paths or CSS gradient overlays masked to each side of the line.
- Do not use hard fills. Keep it translucent and atmospheric.

#### Frame 2.2s — Unit Pips Appear

- 4–8 small triangles (Directorate) and circles (Outlier) appear near the front line.
- They drift slowly toward the line over 1.0s.
- Size: 6–10px.
- Directorate pips: `--color-directorate` with white border.
- Outlier pips: `--color-outlier` with white border.
- Motion: subtle translate, not fast.

```css
.pip {
  animation: driftToFront 1.0s ease-in-out forwards;
  animation-delay: 2.2s;
}
@keyframes driftToFront {
  from { transform: translateX(var(--drift-start)); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}
```

#### Frame 2.8s — Command Standard Marker

- A Command Standard icon (SVG: vertical pole + small banner rectangle) appears at the contested midpoint of the front line.
- It pulses: scale 0.8 → 1.1 → 1.0 over 0.5s.
- Color: `--color-standard`.
- Audio: soft pulse tone.

```svg
<g class="standard-marker" transform="translate(50%, 50%)">
  <rect x="-1.5" y="-18" width="3" height="22" fill="#f5e96b" rx="1"/>
  <rect x="0" y="-18" width="10" height="7" fill="#ffffff" rx="1"/>
</g>
```

#### Frame 3.2s — Title Reveal

- Text fades and scales in from slightly below center.
- Line 1: **FIRELINE COMMAND** — large, bold, `--color-title`.
- Animation: opacity 0 → 1, translateY(12px) → translateY(0) over 0.5s.

```css
.title {
  font-size: clamp(2rem, 6vw, 4rem);
  color: #ffffff;
  animation: riseIn 0.5s ease-out forwards;
  animation-delay: 3.2s;
}
@keyframes riseIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

#### Frame 3.8s — Catchphrase Reveal

- Line 2: **Join the battle. Turn the front.** — smaller, `--color-subtitle`.
- Same animation, 0.2s after title.

#### Frame 4.5s — Menu Fade-In

- If assets are ready: menu options fade in over the tactical background, or the splash fades to black and the menu appears.
- If assets are still loading: hold on title + catchphrase with a subtle pulsing status line:

```
Preparing the front…
```

### Implementation Notes

| Concern | Recommendation |
|---|---|
| Framework | Vanilla JS + SVG + CSS animations |
| No WebGL required | Confirmed |
| Mobile | Use `vw`/`vh` units throughout |
| Reduced motion | Respect `prefers-reduced-motion`: skip to title immediately |
| Skip | Add `click`/`keydown` listener from frame 0.8s onward |
| Performance | All elements are SVG/DOM. No canvas required. |

### Reduced Motion Fallback

```css
@media (prefers-reduced-motion: reduce) {
  .grid, .front-line, .pip, .standard-marker, .title, .subtitle {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

---

## Concept 2: Command Boot Sequence

### Summary

A cold tactical display powers on. Text fragments appear line by line as if a command system is initialising. Status lines resolve. The title reveals. The menu fades in.

### Why It Works

- Strong Syndicate-like agent-command feel.
- Extremely cheap to implement — pure text and CSS.
- Reinforces the game's deterministic/server-authoritative systems without explaining them dryly.
- Works on any device, any connection speed.
- Naturally tied to real loading milestones.

### Step-by-Step Script

#### Frame 0.0s — Black with Cursor

- Background: `--color-black`.
- A single blinking cursor appears top-left or center.
- Cursor: `|` or `_`, blinking at 0.6s interval.

#### Frame 0.3s — System Header

```
FIRELINE COMMAND SYSTEM
FIELD TERMINAL v1.0
```

- Monospace font.
- Color: `--color-subtitle` (pale cyan/slate).
- Appears character by character or line by line.
- Typewriter effect: 30–40ms per character.

#### Frame 0.9s — Boot Lines Begin

Lines appear sequentially, each after a short pause (0.2–0.4s between lines):

```
FRONT SYNC .............. ACTIVE
REGENT CHANNEL .......... ONLINE
FOG VIEW ................ FILTERED
COMMAND STANDARD ........ CONTESTED
FIELD COMMAND ........... ASSIGNED
```

- Each line types out left to right.
- The right-hand status word appears last with a brief flash.
- Status colors:
  - `ACTIVE` / `ONLINE` / `ASSIGNED` → pale green or `--color-standard`
  - `CONTESTED` → `--color-front-line` (amber)
  - `FILTERED` → `--color-subtitle`

#### Frame 2.5s — Separator

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

A horizontal rule draws across the terminal over 0.3s.

#### Frame 2.8s — Faction Status (Optional, Wave 3+)

```
DIRECTORATE FRONT ....... HOLDING
OUTLIER CONTACT ......... CONFIRMED
```

Skip this block before factions are implemented.

#### Frame 3.2s — Title Reveal

The terminal clears or dims. The title rises:

```
FIRELINE COMMAND
```

Large, bold, centered, `--color-title`.

#### Frame 3.7s — Catchphrase

```
Join the battle. Turn the front.
```

Smaller, `--color-subtitle`, fades in below the title.

#### Frame 4.5s — Menu Fade-In

Menu options appear below the catchphrase, or the terminal fades to the main menu background.

### Typewriter Implementation

```javascript
async function typeText(element, text, msPerChar = 35) {
  for (const char of text) {
    element.textContent += char;
    await delay(msPerChar);
  }
}

async function runBootSequence(lines) {
  for (const { label, status, color } of lines) {
    const row = createRow(label, status, color);
    terminal.appendChild(row);
    await typeText(row.labelEl, label, 30);
    await delay(80);
    await typeText(row.statusEl, status, 40);
    await delay(200);
  }
}
```

### Boot Lines Tied to Loading

Map each boot line to a real loading milestone:

| Boot line | Loading milestone |
|---|---|
| `FRONT SYNC: ACTIVE` | App JS loaded |
| `REGENT CHANNEL: ONLINE` | Manifest loaded |
| `FOG VIEW: FILTERED` | UI assets loaded |
| `COMMAND STANDARD: CONTESTED` | Map/terrain assets loaded |
| `FIELD COMMAND: ASSIGNED` | All assets ready |

If loading is fast, lines appear at minimum intervals (0.2s each).  
If loading is slow, hold on the current line with a blinking cursor until the milestone resolves.

### Implementation Notes

| Concern | Recommendation |
|---|---|
| Framework | Vanilla JS + CSS |
| Font | Monospace: `"Courier New"`, `"Consolas"`, or `"JetBrains Mono"` |
| No WebGL required | Confirmed |
| Mobile | Scale font with `clamp()` |
| Skip | On click/tap: complete all lines instantly, then show title |
| Reduced motion | Show all lines at once, no typewriter effect |

### CSS Skeleton

```css
.terminal {
  font-family: "Courier New", monospace;
  font-size: clamp(0.75rem, 2vw, 1rem);
  color: var(--color-subtitle);
  padding: 2rem;
  max-width: 480px;
  margin: auto;
}

.boot-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.4rem;
  opacity: 0;
  animation: fadeIn 0.2s ease forwards;
}

.boot-status.active   { color: #7be87b; }
.boot-status.contested { color: var(--color-front-line); }
.boot-status.online   { color: #7be87b; }
```

---

## Concept 4: Diorama Table Reveal

### Summary

Darkness lifts like a lid opening over a miniature battlefield. Warm light sweeps in. Low-poly terrain, roads, rivers, and base markers become visible. A Command Standard catches the light. The camera holds. The title fades in over the scene.

### Why It Works

- Best concept for selling the painted low-poly hybrid art style.
- Makes the game feel tactile, charming, and toy-like.
- Strong storefront and promotional identity.
- Works as a living menu background once the intro completes.

### When to Use

This concept requires more finished art assets than Concepts 1 and 2.

Recommended implementation order:

- **First build:** Use a static painted illustration or pre-rendered image as the diorama.
- **Later build:** Replace with a live three.js scene once the asset pipeline matures.

### Step-by-Step Script

#### Frame 0.0s — Black

Complete darkness. Silence or very faint ambient hum.

#### Frame 0.4s — Warm Light Sweeps In

- A soft warm light source fades in from above-left, as if a lamp is being switched on over a tabletop.
- Implemented as a radial gradient overlay that fades from transparent to a warm amber/cream.
- The light reveals the scene beneath it progressively.

```css
.light-sweep {
  background: radial-gradient(
    ellipse 80% 60% at 35% 30%,
    rgba(255, 220, 160, 0.18) 0%,
    rgba(0, 0, 0, 0.0) 70%
  );
  animation: lightFadeIn 1.2s ease forwards;
  animation-delay: 0.4s;
}
```

#### Frame 0.6s — Terrain Appears

- The battlefield terrain fades in beneath the light.
- Roads, rivers, rough ground, and forest patches become visible.
- If using a static image: fade in a pre-rendered diorama illustration.
- If using three.js: fade in the scene with a low-opacity overlay that lifts.

#### Frame 1.2s — Base Markers Appear

- Directorate base marker (slate blue pad/pylon) fades in on one side.
- Outlier base marker (terracotta canvas/crate cluster) fades in on the other.
- Small unit silhouettes are visible near the bases.

#### Frame 1.8s — Command Standard Catches the Light

- The Command Standard at the center of the map catches a brief warm light flash.
- A subtle glow pulse: scale 1.0 → 1.05 → 1.0 over 0.4s.
- This is the emotional focal point of the scene.

#### Frame 2.4s — Camera Hold

- The scene holds still for 0.8–1.0s.
- Subtle ambient motion: a tiny dust particle drift, a flag cloth bob, a distant pip moving.
- This is the "breathe" moment before the title.

#### Frame 3.2s — Title Fades In Over Scene

- **FIRELINE COMMAND** fades in, centered, over the diorama.
- Use a subtle dark vignette behind the text for readability.
- Color: `--color-title` (white).

```css
.title-overlay {
  background: radial-gradient(
    ellipse 60% 30% at 50% 55%,
    rgba(0,0,0,0.55) 0%,
    transparent 100%
  );
}
```

#### Frame 3.8s — Catchphrase

- **Join the battle. Turn the front.** fades in below the title.

#### Frame 4.6s — Menu Appears

- Menu options fade in over the diorama scene.
- The diorama continues as a living animated menu background.
- This is the ideal end state: the menu IS the battlefield.

### Static Image Fallback (First Build)

For the first implementation, use a single pre-rendered or illustrated image:

```html
<div class="splash-diorama">
  <img
    src="assets/splash/diorama_battlefield.webp"
    alt=""
    role="presentation"
    class="diorama-image"
  />
  <div class="light-sweep"></div>
  <div class="title-overlay">
    <h1 class="title">FIRELINE COMMAND</h1>
    <p class="subtitle">Join the battle. Turn the front.</p>
  </div>
</div>
```

### Three.js Live Scene (Later Build)

When the asset pipeline is ready:

- Render a small fixed diorama scene in three.js.
- Use the same scene as the menu background.
- Camera: orthographic or shallow perspective, 40–50° downward angle.
- Lighting: one warm directional light + ambient.
- Animate: flag cloth bob (sine wave), dust particles, distant pip movement.
- Keep the scene low-poly and low-cost — it is a background, not a gameplay view.

### Implementation Notes

| Concern | Recommendation |
|---|---|
| First build | Static WebP image + CSS animation |
| Later build | three.js scene, same camera as gameplay |
| Mobile | Use `object-fit: cover` on the image |
| Performance | Cap three.js scene at 30fps when used as background |
| Reduced motion | Static image only, no animation |
| Skip | Fade to menu immediately on click/tap |

---

## Concept 6: Drop Into Battle

### Summary

The camera starts high above a dark map. It rapidly zooms toward an active front. Unit icons resolve into tiny low-poly models. The title appears as the camera settles at tactical altitude.

### Why It Works

- Directly communicates the "join active battle" no-lobby design.
- Feels like being dropped into a war already in progress.
- The zoom creates immediate kinetic energy.
- Works as a pure CSS/SVG zoom or as a three.js camera move.

### Step-by-Step Script

#### Frame 0.0s — Black

Complete darkness.

#### Frame 0.3s — Map Appears From Far Above

- A top-down tactical map view fades in, very small, as if seen from high altitude.
- The map shows terrain patches, roads, rivers, and base markers.
- Unit pips are visible as tiny dots.
- Scale: the map occupies roughly 20–30% of the screen at this zoom level.

#### Frame 0.6s — Zoom Begins

- The map scales up rapidly: transform scale 0.25 → 1.0 over 1.5s.
- Use a smooth ease-in-out curve, not linear.
- The camera appears to be descending toward the battlefield.

```css
.map-container {
  transform: scale(0.25);
  animation: zoomIn 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  animation-delay: 0.6s;
}
@keyframes zoomIn {
  to { transform: scale(1.0); }
}
```

#### Frame 1.2s — Unit Icons Resolve

- As the zoom passes 60% scale, unit pips grow large enough to resolve into unit silhouettes.
- Directorate units: angular, plated shapes.
- Outlier units: lighter, asymmetric shapes.
- This can be a simple CSS swap: small circle → unit SVG icon at a scale threshold.

```javascript
mapContainer.addEventListener('animationiteration', () => {});
// Or use IntersectionObserver / animation progress to swap icons at 60% zoom
```

#### Frame 1.8s — Front Line Becomes Visible

- As the zoom settles, the contested front line becomes visible between the two sides.
- The Command Standard marker pulses at the contested point.
- Color: `--color-standard`.

#### Frame 2.2s — Camera Settles

- Zoom completes. The map is now at full tactical view.
- A brief camera shake: translateX(±3px) twice over 0.2s.

```css
@keyframes settle {
  0%   { transform: translateX(0); }
  25%  { transform: translateX(-3px); }
  75%  { transform: translateX(3px); }
  100% { transform: translateX(0); }
}
```

#### Frame 2.5s — Title Appears

- **FIRELINE COMMAND** fades in over the settled map.
- Use a dark vignette behind the text.

#### Frame 3.0s — Catchphrase

- **Join the battle. Turn the front.** fades in below.

#### Frame 3.8s — Menu Fade-In

- Menu options appear.
- The tactical map continues as a subtle animated background.

### Zoom Implementation: Two Approaches

#### Approach A: CSS Transform Zoom (First Build)

Use a single SVG or image of the battlefield and scale it with CSS.

Pros:
- No WebGL required.
- Works on all devices.
- Very fast to implement.

Cons:
- The map is a static image; unit icons do not actually move.

```html
<div class="zoom-wrapper">
  <svg class="map-container" viewBox="0 0 800 600">
    <!-- terrain patches, roads, rivers, base markers, unit pips -->
  </svg>
</div>
```

#### Approach B: Three.js Camera Zoom (Later Build)

Use the actual game renderer. Start the camera at high altitude and animate it down to tactical altitude.

```javascript
// Start position: high above center
camera.position.set(0, 800, 0);
camera.lookAt(0, 0, 0);

// Animate to tactical position
gsap.to(camera.position, {
  y: 120,
  duration: 2.0,
  ease: "power2.inOut",
  onUpdate: () => camera.lookAt(0, 0, 0)
});
```

Pros:
- Uses real game assets.
- Seamlessly transitions into the live menu background.
- Most dramatic and immersive.

Cons:
- Requires WebGL assets to be loaded first.
- More complex to implement.

Recommended order:
- Ship Approach A first.
- Replace with Approach B once the asset pipeline is stable.

### Implementation Notes

| Concern | Recommendation |
|---|---|
| First build | CSS transform scale on SVG map |
| Later build | three.js camera animation |
| Mobile | Ensure map SVG is responsive; use `viewBox` |
| Performance | CSS approach is zero-cost; three.js approach needs asset gate |
| Reduced motion | Skip zoom; fade directly to settled map + title |
| Skip | Jump to settled map + title immediately on click/tap |

### Reduced Motion Fallback

```css
@media (prefers-reduced-motion: reduce) {
  .map-container {
    animation: none;
    transform: scale(1.0);
    opacity: 1;
  }
}
```

---

## Recommended Build Order

| Phase | Concept | Implementation |
|---|---|---|
| First build | Concept 2: Command Boot Sequence | Pure HTML/CSS/JS. Zero asset dependency. Ships immediately. |
| Second build | Concept 1: The Front Ignites | SVG + CSS. Adds faction territory and front line. |
| Third build | Concept 6: Drop Into Battle (CSS) | CSS zoom on SVG map. Adds kinetic energy. |
| Fourth build | Concept 4: Diorama Table Reveal (static) | Static WebP diorama image + CSS light sweep. |
| Final build | Concept 4 or 6 (three.js) | Live three.js scene. Replaces static image. |

---

## Combining Concepts

The four concepts are not mutually exclusive. A strong final splash could combine:

**Concept 6 (zoom) → Concept 1 (front line ignites) → Concept 2 (boot text overlay) → Concept 4 (diorama hold)**

Example combined sequence:

| Time | What happens |
|---|---|
| 0.0s | Black |
| 0.3s | Map appears from altitude (Concept 6) |
| 0.6s | Zoom begins toward front |
| 1.5s | Camera settles; front line ignites (Concept 1) |
| 2.0s | Boot text overlays briefly: "COMMAND ASSIGNED" (Concept 2) |
| 2.5s | Diorama light sweep warms the scene (Concept 4) |
| 3.0s | FIRELINE COMMAND title reveals |
| 3.6s | Join the battle. Turn the front. |
| 4.5s | Menu fades in |

This combined version is the recommended long-term target once all asset tiers are available.

---

## Acceptance Criteria

A splash screen implementation is complete when:

- [ ] Intro plays correctly on desktop Chrome and Firefox.
- [ ] Intro plays correctly on mobile Chrome and Safari.
- [ ] Intro is skippable via click, tap, Enter, or Space once assets are ready.
- [ ] Intro does not block menu if loading completes early.
- [ ] Intro holds gracefully if loading is slow.
- [ ] Title text reads: **FIRELINE COMMAND**
- [ ] Catchphrase reads: **Join the battle. Turn the front.**
- [ ] `prefers-reduced-motion` is respected.
- [ ] No WebGL dependency in the first build.
- [ ] No unskippable delay longer than 1.5s after assets are ready.
