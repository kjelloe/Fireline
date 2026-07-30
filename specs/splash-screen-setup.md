### Splash / Intro Direction for **Fireline Command**

For this game, the intro should be **short, dramatic, readable, and cheap to run while assets load**.

I would avoid a long cinematic. The game’s philosophy is **join active battle, no waiting**, so the intro should feel like a **brief tactical boot sequence into a living war**.

Ideal duration:

| Use case | Duration |
|---|---:|
| First visit / cold load | 4–7 seconds |
| Returning player / cached assets | 1.5–3 seconds |
| Low-end mobile | Static splash with subtle motion |
| User clicks/taps | Skip immediately once core assets are ready |

Primary text:

> **FIRELINE COMMAND**  
> **Join the battle. Turn the front.**

---

## Top 10 Splash / Intro Concepts

| # | Concept | What the player sees | Why it fits |
|---:|---|---|---|
| 1 | **The Front Ignites** | Black screen. A thin glowing tactical line draws across the map. Red/blue front zones flicker into view. A Command Standard marker appears at the contested center. Title fades in. | Best all-rounder. Communicates frontlines, tactical map, and active war immediately. |
| 2 | **Command Boot Sequence** | A cold tactical display powers on: grid lines, unit pips, “front sync,” “regent online,” “command assigned.” Then the UI resolves into the main menu. | Strong Syndicate/agent-command feel. Very cheap to implement with HTML/CSS/SVG. |
| 3 | **Standard in the Smoke** | Fade from black into a painted low-poly Command Standard standing in battlefield smoke. Distant silhouettes move behind it. A shell flash lights the banner. | Dramatic and objective-focused. Good if the Command Standard is the emotional core. |
| 4 | **Diorama Table Reveal** | Darkness lifts like a lid opening over a miniature battlefield. Low-poly terrain, tiny units, roads, rivers, and base markers appear under warm light. | Best for showing the painted low-poly tabletop identity. |
| 5 | **Two Factions, One Front** | Directorate blue grid-shield appears on one side, Outlier terracotta broken-arrow on the other. Their colors push against each other along a jagged front line. | Best for introducing faction identity once Wave 3 is in. |
| 6 | **Drop Into Battle** | Camera starts high above a dark map, then rapidly zooms toward an active front. Unit icons turn into tiny models. Title appears as the camera settles. | Captures “join active battle” and the no-lobby design. |
| 7 | **Radio Intercept** | Black screen with faint radio static. Fragments of mission text appear: “front unstable,” “standard exposed,” “command channel open.” Then logo fades in. | Moody, cheap, good for browser/mobile. Strong agent-mission flavor. |
| 8 | **The Standard Falls** | A banner silhouette stands in smoke, then is struck / drops / tilts. The front line pulses red. Text: “Join the battle.” Then another unit raises a marker: “Turn the front.” | Very dramatic, but slightly more negative. Good if the game emphasizes recovery and reversal. |
| 9 | **Painted War Poster** | A static illustrated splash: Directorate armor on one side, Outlier skimmer on the other, Command Standard between them. Subtle parallax, dust, and light sweeps. | Best if you want a branded key art image. More art effort, very strong storefront/menu identity. |
| 10 | **Regent Handoff** | Tactical HUD shows an AI Regent holding the line. A human command signal connects. Text changes from “Regent holding” to “Command assigned.” Menu appears. | Best for explaining AI regency and drop-in continuity. Unique to your game. |

---

## My Top 3 Recommendations

### 1. **The Front Ignites**

This is my strongest recommendation.

#### Sequence

1. Start on black.
2. A faint map grid fades in.
3. A thin front line draws across the screen like a glowing ember.
4. Blue-gray Directorate territory blooms on one side.
5. Terracotta Outlier territory blooms on the other.
6. Small unit pips move near the line.
7. A Command Standard icon flashes at the contested point.
8. Title appears:

> **FIRELINE COMMAND**  
> **Join the battle. Turn the front.**

9. Fade into menu.

#### Why it works

- Explains the title.
- Shows the “front” visually.
- Supports both factions.
- Works before full 3D assets are loaded.
- Can be implemented with SVG/CSS/canvas.
- Scales well on mobile.
- Feels tactical, dramatic, and fast.

#### Implementation style

Use mostly:

- black background;
- SVG tactical line;
- CSS opacity/transform animation;
- small pips;
- no heavy WebGL requirement.

This can load instantly while WebGL assets stream in behind it.

---

### 2. **Command Boot Sequence**

This is the best if you want stronger **Syndicate-like interface energy**.

#### Example text fragments

```text
FRONT SYNC: ACTIVE
REGENT CHANNEL: ONLINE
FOG VIEW: FILTERED
COMMAND STANDARD: CONTESTED
FIELD COMMAND: ASSIGNED
```

Then:

> **FIRELINE COMMAND**  
> **Join the battle. Turn the front.**

#### Why it works

- Very cheap to build.
- Feels like the player is taking over an active battlefield.
- Reinforces deterministic/server-authoritative systems without explaining them dryly.
- Can use faction colors and symbols later.

#### Risk

It may feel slightly too UI-heavy if overdone. Keep it short and punchy.

---

### 3. **Diorama Table Reveal**

This is the best if you want to sell the **painted low-poly hybrid art style**.

#### Sequence

1. Black.
2. Warm light fades in over a miniature battlefield.
3. Roads, rivers, and tiny bases become visible.
4. A small Command Standard catches the light.
5. Distant explosions are represented as soft painted flashes.
6. Camera holds for a second.
7. Menu fades over the scene.

#### Why it works

- Strongly supports the chosen art style.
- Makes the game feel tactile and charming.
- Good for future promotional identity.

#### Risk

It requires more finished art assets. I’d use this after the asset pipeline matures, not as the first splash.

---

## Recommended First Version

For the first real implementation, I would combine **1 + 2**:

## **“The Front Ignites” with a Tactical Boot Overlay**

This gives you maximum impact for minimum asset dependency.

### Proposed Intro Script

#### 0.0s — Black

Silent or low hum.

#### 0.4s — Grid emerges

A faint tactical grid fades in.

```text
FRONT SYNC
```

#### 0.8s — Front line draws

A jagged line draws horizontally/diagonally across the screen.

Blue-gray glow on one side, terracotta glow on the other.

```text
ACTIVE WAR FOUND
```

#### 1.5s — Unit pips move

Small triangles/circles converge near the line.

```text
COMMAND CHANNEL OPEN
```

#### 2.2s — Standard marker appears

A Command Standard icon pulses at the contested point.

```text
STANDARD CONTESTED
```

#### 3.0s — Title reveal

> **FIRELINE COMMAND**

#### 3.5s — Catchphrase

> **Join the battle. Turn the front.**

#### 4.5s — Fade into menu

Menu options fade in over the same background, or the splash fades out fully.

---

## Visual Style

Use:

| Element | Style |
|---|---|
| Background | Near-black blue/charcoal |
| Grid | Dim pale cyan / slate |
| Directorate area | Slate gray + police blue |
| Outlier area | Terracotta + sun-bleached tan |
| Front line | Warm ember / off-white tactical glow |
| Standard icon | White/gold pulse |
| Typography | Bold condensed sans or block military-style font |
| Motion | Smooth, minimal, deliberate |
| Audio | Low hum, short radio chirp, distant thump, title hit |

Avoid:

- long logo animations;
- photoreal explosion videos;
- heavy WebGL dependency;
- unskippable intros;
- lore paragraphs;
- “loading…” as the main experience.

---

## Loading Behavior Recommendation

The splash should be tied to real loading, but not expose technical noise.

### States

| Loader state | Splash behavior |
|---|---|
| Initial app boot | Show black + faint hum |
| Manifest loaded | Draw tactical grid |
| Core UI assets loaded | Draw front line |
| Core game assets loading | Animate pips/standard |
| Ready for menu | Reveal title and menu |
| Slow connection | Continue subtle loop after title |
| User taps/clicks | If ready, skip to menu |

### Important UX Rule

Do not trap the player in the intro.

If loading is complete, allow:

- click;
- tap;
- Enter;
- Escape.

If loading is not complete, click can accelerate the intro to the title but keep a small status:

```text
Preparing the front…
```

---

## My Final Recommendation to the Ally

```markdown
Implement the first splash screen as:

Name:
- The Front Ignites

Purpose:
- Provide a dramatic but lightweight intro while UI/assets load.
- Reinforce the title, no-lobby concept, factions, and living front.

Visual sequence:
1. Fade from black.
2. Show faint tactical grid.
3. Draw jagged glowing front line.
4. Bloom Directorate slate-blue territory on one side.
5. Bloom Outlier terracotta territory on the other.
6. Animate a few unit pips converging.
7. Pulse a Command Standard marker.
8. Reveal:
   FIRELINE COMMAND
   Join the battle. Turn the front.
9. Fade into main menu.

Implementation:
- Use HTML/CSS/SVG or Canvas 2D.
- Do not require WebGL.
- Do not wait on 3D models.
- Must work on mobile.
- Must be skippable once ready.
- Keep total intro around 4–5 seconds on first load.
- If loading takes longer, hold on animated tactical map/title state.
```

This gives you a strong branded first impression without blocking the practical asset-loading flow.
