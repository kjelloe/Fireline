### More Firepower Art Asset Spec  
#### Style Direction: Painted Low-Poly Hybrid

This spec is written for the local coding ally, technical artist, or asset pipeline maintainer who will begin implementing the first visual identity pass for **More Firepower**.

The chosen direction is:

> **Painted Low-Poly Hybrid** — low-poly 3D models with warm hand-painted textures, baked lighting, chunky silhouettes, and strong tactical readability.

The style should work across:

- Desktop browser with three.js/WebGL.
- Mobile browser with WebGL.
- Canvas/sprite fallback for low-capability devices.
- Future Roblox adaptation.

---

### 1. Art Direction Summary

#### Core Visual Fantasy

**More Firepower** should look like a painted tabletop battlefield brought to life.

Units, terrain, standards, and wrecks should feel like:

- miniature wargame pieces;
- toy soldiers;
- hand-painted battlefield props;
- readable at a distance;
- charming rather than realistic;
- physical and tactile;
- dramatic but not gritty.

The game is not aiming for military realism. It is aiming for:

> “A living low-poly war diorama with painted toy-soldier charm.”

#### Keywords

| Category | Keywords |
|---|---|
| Shape | Chunky, simple, iconic, readable |
| Texture | Hand-painted, brushed, baked shadows, matte |
| Lighting | Warm, soft, baked, not high-gloss |
| Mood | Tactical, playful, dramatic, accessible |
| Camera | 2.5D / diorama / slightly elevated |
| Combat | Explosive but readable |
| UI Relation | Clear overlays, strong state icons, color redundancy |

---

### 2. Technical Target

#### Runtime Targets

| Target | Requirement |
|---|---|
| Desktop WebGL | Primary target |
| Mobile WebGL | Must remain performant |
| Canvas fallback | Supported through pre-rendered sprites |
| Roblox future port | Assets should be exportable and materially simple |

#### Renderer Assumption

The game uses **three.js** as a non-authoritative presentation adapter.

The renderer:

- consumes server snapshots/deltas;
- interpolates movement;
- plays animations and VFX;
- displays state feedback;
- never calculates game logic.

#### Asset Format Recommendation

| Asset Type | Recommended Format |
|---|---|
| 3D models | `glTF` / `GLB` |
| Textures | PNG or WebP |
| Sprite fallback | PNG sprite sheets |
| Icons | SVG where possible |
| Roblox transfer | FBX/OBJ/GLB + PNG textures |

---

### 3. Visual Scale & Camera Assumptions

The battlefield is a 2.5D tactical diorama.

#### Camera

Recommended initial camera:

| Property | Value |
|---|---|
| Projection | Orthographic or shallow perspective |
| Angle | 35–55 degrees downward |
| Rotation | Slight isometric bias |
| Zoom levels | Strategic, tactical, close |
| Unit visibility | Units must be readable at normal tactical zoom |

#### Unit Scale

Use the existing fixed-point grid logic as the conceptual gameplay scale.

Suggested visual relation:

| Object | Visual Footprint |
|---|---|
| Infantry | 0.25–0.35 cell width |
| Light vehicle | 0.45–0.60 cell width |
| Heavy vehicle | 0.60–0.80 cell width |
| Command Standard | 0.20 cell base, tall vertical silhouette |
| Wreck | Same footprint as source unit, flattened/broken |
| Depot / command zone | 1–3 cells |

---

### 4. General Asset Rules

#### Shape Language

Use strong silhouettes first.

Every unit should be identifiable from:

- top-down angle;
- small screen;
- mobile resolution;
- foggy/low-contrast terrain;
- quick glance during movement.

Avoid:

- tiny antennas as primary identifiers;
- thin weapons as the only differentiator;
- excessive small details;
- realistic scale ratios that make infantry unreadable.

Prefer:

- exaggerated body shapes;
- broad helmets;
- chunky barrels;
- oversized wheels/tracks;
- clear role silhouettes;
- visible team banners or panels.

#### Texture Language

Textures should be hand-painted or painted-looking.

Use:

- broad brush strokes;
- baked ambient occlusion;
- edge highlights;
- simple grime;
- limited scratches;
- painted team panels;
- matte finish.

Avoid:

- photorealistic textures;
- high-frequency noise;
- realistic dirt maps that muddy readability;
- complex camo patterns;
- shiny PBR-heavy materials.

#### Lighting

Bake most visual depth into textures.

Use runtime lighting lightly.

Recommended:

- 1 soft directional light;
- ambient light;
- optional hemisphere light;
- baked shadows in texture;
- simple blob shadows under units.

Avoid relying on:

- dynamic shadow maps for every unit;
- complex reflections;
- screen-space effects;
- expensive post-processing.

---

### 5. Poly Budgets

These are first-pass targets, not hard laws.

| Asset | Target Triangles | Maximum Triangles |
|---|---:|---:|
| Infantry | 600–1,000 | 1,500 |
| Specialist infantry | 800–1,200 | 1,800 |
| Light vehicle | 1,000–1,800 | 2,500 |
| Heavy vehicle | 1,500–2,500 | 3,500 |
| Recovery/tow vehicle | 1,200–2,200 | 3,000 |
| Command Standard | 200–600 | 1,000 |
| Wreck variant | 500–1,500 | 2,000 |
| Terrain prop | 100–800 | 1,200 |
| Large structure | 1,000–3,000 | 5,000 |

#### Mobile Rule

For mobile, assume many units can be visible simultaneously.

Therefore:

> Prefer 1,000 good triangles over 3,000 decorative triangles.

#### Roblox Rule

Keep shapes simple enough to survive import and material simplification.

---

### 6. Texture Budgets

| Asset | Texture Size |
|---|---:|
| Infantry | 128×128 or 256×256 |
| Vehicles | 256×256 |
| Hero/standard assets | 256×256 |
| Structures | 256×256 or 512×512 |
| Terrain tile atlas | 512×512 or 1024×1024 |
| UI icons | SVG or 64×64 PNG |
| Sprite fallback | 64×64 or 96×96 per frame |

#### Texture Set

For first implementation, use:

| Map | Required? | Notes |
|---|---|---|
| Albedo | Yes | Painted color + baked light. |
| Normal | Optional | Avoid unless needed. |
| Roughness | Optional | Usually flat/matte. |
| Metalness | No / minimal | Avoid shiny realism. |
| Emissive | Optional | For UI-like highlights only. |

Recommended minimum:

```text
model.glb
model_albedo.png
```

Or packed:

```text
model.glb with embedded texture
```

---

### 7. Team Color System

Team identity must not depend only on subtle texture differences.

Use at least two identifiers:

1. Color.
2. Shape/icon/banner.

#### Recommended Team Color Slots

Each unit should support tintable team panels.

Suggested material slots:

| Slot | Purpose |
|---|---|
| `base_painted` | Main painted body texture |
| `team_primary` | Team color panel |
| `team_secondary` | Stripe, flag, or small marking |
| `state_overlay` | Optional runtime highlight |

#### Team Marking Locations

Use consistent locations:

| Unit Type | Marking Location |
|---|---|
| Infantry | Helmet stripe, backpack, small pennant |
| Vehicle | Side panels, turret stripe, top decal |
| Recovery vehicle | Rear panel + towing hook color |
| Standard carrier | Banner + circular base ring |
| Wreck | Faded/burned team panel |

#### Colorblind Support

Every team color should also have a symbol.

Examples:

| Team | Symbol |
|---|---|
| Red | Triangle |
| Blue | Circle |
| Green | Square |
| Yellow | Diamond |

These symbols should appear on:

- standards;
- command zones;
- minimap icons;
- selected unit rings;
- important UI panels.

---

### 8. Required First Asset Set

The first asset pass should focus on making the Command Standard loop playable and readable.

#### P0 Asset Kit

| Asset | Purpose | Priority |
|---|---|---|
| Infantry carrier | Can carry Command Standard | Critical |
| Light vehicle | Basic combat/movement test unit | Critical |
| Recovery/tow vehicle | Enables wreck rescue loop | Critical |
| Command Standard | Core objective object | Critical |
| Dropped Standard | Ground-state objective | Critical |
| Command Zone | Scoring/home zone | Critical |
| Disabled infantry/wreck | Disabled state | Critical |
| Disabled vehicle/wreck | Wreck state | Critical |
| Tow cable visual | Recovery/tow readability | High |
| Selection ring | Click-select readability | High |
| Move order marker | Command feedback | High |
| Attack order marker | Command feedback | High |
| Cooldown indicator | Fire cooldown feedback | High |
| Minimap unit icons | Strategic readability | High |

#### Nice-to-Have P0 Assets

| Asset | Purpose |
|---|---|
| Tiny dust puff | Movement feedback |
| Muzzle flash | Combat feedback |
| Hit spark | Impact feedback |
| Capture glow/ring | Standard scoring feedback |
| Repair sparkle | Tow-back recovery feedback |
| Exhaust puff | Vehicle identity |

---

### 9. Command Standard Visual Spec

The Command Standard is the most important object in the game.

It must be unmistakable.

#### Standard States

| State | Visual |
|---|---|
| At base | Upright in command zone |
| Carried | Attached to carrier, waving or bobbing |
| Dropped | Lying/tilted on ground with visible marker |
| Contested | Pulsing ring or crossed-color highlight |
| Returned | Snap-back/raise animation |
| Scored | Large celebratory banner animation |

#### Shape

The standard should have:

- tall silhouette;
- team symbol;
- painted cloth/banner;
- chunky pole;
- round or hexagonal base when dropped;
- optional tassels or simple ribbons.

Avoid making it realistic or thin.

It should read clearly even as a minimap icon.

#### Suggested Variants

```text
standard_team_red.glb
standard_team_blue.glb
standard_dropped_red.glb
standard_dropped_blue.glb
standard_icon_red.svg
standard_icon_blue.svg
```

Or one neutral model plus tintable team materials.

---

### 10. Wreck and Tow Visual Spec

The wreck-recovery mechanic needs strong visual language.

#### Disabled/Wreck State

Disabled assets should look:

- slumped;
- darkened;
- slightly smoking;
- intact enough to identify;
- recoverable, not erased.

Do not make wrecks too realistic or gory.

#### Wreck Variants

For each major unit class:

| Unit | Wreck Variant |
|---|---|
| Infantry | Downed marker / broken base / knocked-over figure |
| Light vehicle | Cracked hull, tilted wheels/tracks |
| Recovery vehicle | Disabled tow arm |
| Heavy vehicle later | Burned turret / broken barrel |

#### Tow Cable

The tow cable can be a runtime visual, not a model.

Recommended implementation:

- simple curved line;
- tube geometry in WebGL;
- SVG/canvas line fallback;
- attach from recovery vehicle hitch to wreck hitch;
- color: dark rope/brown or black cable;
- optional tension animation.

#### Tow Attach Points

Every towable asset should expose named anchors if possible:

```text
tow_front
tow_rear
tow_center
```

If glTF naming is too much early on, maintain anchor offsets in a metadata file.

Example:

```json
{
  "light_vehicle": {
    "towRear": [0, 0.15, -0.42],
    "towFront": [0, 0.15, 0.42]
  }
}
```

---

### 11. Animation Requirements

Keep animations short, readable, and optional.

#### First-Pass Animations

| Asset | Animation | Duration |
|---|---|---:|
| Infantry | idle bob | 1–2 sec loop |
| Infantry | carry standard bob | 1–2 sec loop |
| Vehicle | wheel/track scroll optional | loop |
| Standard | cloth bob/wave | 1–2 sec loop |
| Dropped standard | subtle pulse marker | loop |
| Wreck | smoke puff optional | loop |
| Tow vehicle | tow strain/bob optional | loop |

For early implementation, animations can be procedural in the renderer.

Example:

- bob standard pole with sine wave;
- rotate vehicle wheels;
- pulse capture ring;
- scale selection ring.

Do not let animation become required for gameplay logic.

---

### 12. Terrain Asset Spec

Terrain should support readability first.

#### Terrain Types

Existing terrain types include:

| Terrain | Visual Treatment |
|---|---|
| Open | Light grass / painted field |
| Road | Tan/gray path, strong movement affordance |
| Forest | Chunky low-poly tree clusters |
| Rough | Rocks/mud/bumpy ground |
| Blocking | Dark rock/wall/water/impassable marker |

#### Terrain Tiles

Recommended:

- tile atlas;
- simple low-poly props;
- deterministic placement driven by map seed;
- no random client-only prop placement unless seeded from authoritative map data or purely cosmetic and non-blocking.

#### Road Readability

Roads matter because terrain speed exists.

Make roads clearly visible:

- continuous color;
- edge strokes;
- less clutter;
- directional flow.

#### Blocking Terrain

Blocking terrain must be unmistakable.

Use:

- high contrast;
- hard silhouette;
- icon overlay in accessibility mode;
- no ambiguous “maybe passable” rocks.

---

### 13. UI/Gameplay Visual Hooks

The asset system must support these authoritative states from the engine/server.

#### Required State Visuals

| State | Visual Hook |
|---|---|
| Selected | Ring / outline |
| Move order | Arrow or target marker |
| Attack order | Red target marker |
| Fire cooldown | Radial timer / reload icon |
| Carrying standard | Banner mounted to unit + halo |
| Disabled | Wreck model + smoke |
| Being towed | Tow cable + slow movement marker |
| Recovering | Repair icon / progress ring |
| In command zone | Ground ring / base aura |
| Enemy visible | Team marker + fog-aware rendering |
| Fog hidden | Not rendered at all |
| Recently seen | Optional ghost marker, if supported |

#### Important Rule

The client may display state, but it must not invent authoritative state.

For example:

- The client may animate a cooldown UI if the server says cooldown exists.
- The client may not decide whether a unit is allowed to fire.
- The client may show a predicted marker, but it must reconcile with server results.

---

### 14. Fallback Strategy

The same visual identity must degrade gracefully.

#### WebGL Primary

Use:

- GLB models;
- painted albedo textures;
- instanced meshes for repeated units;
- simple materials;
- sprite/billboard VFX.

#### Canvas/Sprite Fallback

For fallback:

- render terrain as tiles;
- render units as pre-baked sprites;
- use the same state-to-visual mapping;
- preserve command standard readability;
- show UI overlays in HTML/SVG.

#### Required Sprite Angles

For first pass:

| Asset | Angles |
|---|---:|
| Infantry | 4 or 8 directions |
| Vehicle | 8 directions |
| Standard | 4 directions or billboard |
| Wreck | 1–4 directions |
| Tow cable | Runtime line |

For simplicity, early fallback can use top-down or isometric sprites with fewer directions.

---

### 15. Roblox Compatibility Notes

To keep eventual Roblox support realistic:

#### Do

- Keep meshes low-poly.
- Use simple materials.
- Use PNG painted textures.
- Keep unit scale consistent.
- Avoid complex skeletal rigs at first.
- Use simple animation loops.
- Use separate models for major states if easier.

#### Avoid

- Custom three.js shaders as required visuals.
- Heavy post-processing.
- Multi-material complexity.
- Very high texture resolution.
- Dense mesh deformation.
- Effects that cannot be recreated with Roblox particles/basic materials.

#### Asset Naming

Use clean names that transfer well:

```text
unit_infantry_carrier.glb
unit_vehicle_light.glb
unit_vehicle_recovery.glb
objective_standard.glb
objective_standard_dropped.glb
wreck_vehicle_light.glb
zone_command_base.glb
```

---

### 16. File and Folder Structure

Recommended structure:

```text
client/
  assets/
    models/
      units/
      objectives/
      terrain/
      wrecks/
      structures/
    textures/
      units/
      terrain/
      ui/
    sprites/
      fallback/
      minimap/
    icons/
      svg/
    metadata/
      asset_manifest.json
      anchor_points.json
      style_tokens.json
```

#### Asset Manifest

Create an asset manifest so code does not hardcode filenames everywhere.

Example:

```json
{
  "units": {
    "infantry_carrier": {
      "webglModel": "assets/models/units/unit_infantry_carrier.glb",
      "fallbackSprite": "assets/sprites/fallback/unit_infantry_carrier.png",
      "minimapIcon": "assets/sprites/minimap/infantry_carrier.png",
      "texture": "assets/textures/units/unit_infantry_carrier_albedo.png",
      "triBudget": 1000
    }
  },
  "objectives": {
    "command_standard": {
      "webglModel": "assets/models/objectives/objective_standard.glb",
      "fallbackSprite": "assets/sprites/fallback/objective_standard.png",
      "minimapIcon": "assets/icons/svg/standard.svg"
    }
  }
}
```

---

### 17. Material Tokens

Create consistent style tokens.

Example:

```json
{
  "materials": {
    "paintedMatte": {
      "roughness": 0.85,
      "metalness": 0.0
    },
    "teamPanel": {
      "roughness": 0.75,
      "metalness": 0.0
    },
    "wornMetal": {
      "roughness": 0.9,
      "metalness": 0.15
    }
  },
  "colors": {
    "teamRed": "#c7443e",
    "teamBlue": "#3d6fb6",
    "teamGreen": "#4f8f4f",
    "teamYellow": "#d1a33a",
    "selection": "#f5e96b",
    "danger": "#e74c3c",
    "recover": "#6bd17b"
  }
}
```

---

### 18. First Implementation Milestones

#### Art Slice A: Asset Manifest and Placeholders

Deliver:

- folder structure;
- `asset_manifest.json`;
- placeholder GLB or primitive models;
- placeholder sprites/icons;
- render pipeline loads assets through manifest.

Test/verify:

- missing asset gives clear fallback;
- manifest keys match renderer usage;
- no hardcoded model path in gameplay logic.

#### Art Slice B: Command Standard Visuals

Deliver:

- standard model;
- dropped standard model/sprite;
- carried standard attachment behavior;
- minimap standard icon;
- command zone marker.

Test/verify:

- standard visible in all required states;
- standard carrier clearly readable;
- dropped standard clearly readable.

#### Art Slice C: Core Unit Kit

Deliver:

- infantry carrier;
- light vehicle;
- recovery vehicle;
- wreck variants;
- tow cable visual.

Test/verify:

- unit types distinguishable at tactical zoom;
- wrecks distinguishable from active units;
- towing state readable.

#### Art Slice D: Feedback Kit

Deliver:

- selection ring;
- move marker;
- attack marker;
- cooldown indicator;
- recovery progress indicator;
- standard capture/return VFX.

Test/verify:

- order states visible;
- cooldown visible;
- capture state visible.

#### Art Slice E: Fallback Sprite Pass

Deliver:

- sprite versions of core units;
- sprite standard/wreck variants;
- Canvas fallback visual parity;
- minimap icons.

Test/verify:

- same state view can render with WebGL or fallback;
- mobile-size readability check passes.

---

### 19. Acceptance Criteria

The first painted low-poly asset pass is acceptable when:

1. The Command Standard is immediately recognizable.
2. Standard carrier is readable at normal tactical zoom.
3. Dropped standard is readable against all terrain types.
4. Active, disabled, towing, and recovering states are visually distinct.
5. Infantry, light vehicle, and recovery vehicle have distinct silhouettes.
6. Team identity uses both color and symbol.
7. Assets work in three.js/WebGL.
8. Assets have sprite fallback equivalents.
9. Assets are low-poly enough for mobile.
10. Assets are simple enough for eventual Roblox adaptation.
11. No visual asset introduces gameplay authority into the client.
12. Art states map cleanly to authoritative state from the server.

---

### 20. Immediate Task for Local Coding Ally

Start with this concrete first task:

```markdown
Implement the Painted Low-Poly Hybrid asset pipeline foundation.

Create:
- `client/assets/` folder structure.
- `client/assets/metadata/asset_manifest.json`.
- `client/assets/metadata/style_tokens.json`.
- `client/assets/metadata/anchor_points.json`.
- placeholder primitive models or procedural stand-ins for:
  - infantry carrier;
  - light vehicle;
  - recovery vehicle;
  - command standard;
  - dropped command standard;
  - light vehicle wreck;
  - command zone.
- placeholder SVG/PNG icons for:
  - standard;
  - infantry;
  - vehicle;
  - recovery;
  - wreck;
  - move;
  - attack;
  - cooldown;
  - recover.

Do not add gameplay logic to the client.

The renderer should load visual definitions from the manifest and map authoritative state keys to assets.

If WebGL is unavailable, fallback to sprite/icon rendering.
```

---

### 21. Short Version for the Ally

```markdown
Art direction is Painted Low-Poly Hybrid.

Build low-poly, hand-painted, mobile-safe assets that can run in three.js/WebGL, degrade to sprite fallback, and later transfer to Roblox.

Prioritize the Command Standard loop:
1. Standard.
2. Carrier.
3. Dropped standard.
4. Command zone.
5. Wrecks.
6. Recovery/tow vehicle.
7. Tow cable.
8. Selection/order/cooldown/recovery feedback.

Use chunky readable silhouettes, painted albedo textures, baked lighting, matte materials, team color panels, and team symbols.

Client only renders authoritative state. It never decides gameplay.

Start by creating:
- asset manifest;
- style tokens;
- anchor points;
- placeholder models/sprites/icons;
- renderer mapping from state visual keys to assets.
```
