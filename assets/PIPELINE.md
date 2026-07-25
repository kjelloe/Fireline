# Asset Pipeline — Painted Low-Poly Hybrid

Implements Art Slice A of `assets/asset-spec.md` (v0.10.0+). The whole visual
identity flows through four files/modules — nothing else may hardcode looks:

```
client/assets/metadata/style_tokens.json     palette, materials, team identity
client/assets/metadata/asset_manifest.json   what exists + where + budgets
client/assets/metadata/anchor_points.json    tow/banner attach offsets
client/js/asset_resolver.js                  authoritative state → visual key
client/js/asset_factory.js                   procedural stand-ins (three.js)
tools/build_assets.mjs                       generates SVG icons/sprites from tokens
```

## How the renderer picks a visual

1. `visualKeyFor(asset)` → `unit_tank` / `wreck_scout` / …;
   `standardVisualKey(standard)` → `standard_upright` / `standard_dropped`.
2. `resolveVisual(manifest, key)` returns, in order of preference:
   **painted GLB** (when the file exists) → **procedural stand-in**
   (asset_factory) → **sprite fallback** (SVG today, baked PNG later).
3. Team identity: every model exposes a `team_panel` mesh slot;
   `applyTeamColor(group, teamToken(tokens, teamId).color)` tints ONLY that
   slot — the painted body is never recolored. Wrecks carry a
   `team_panel_faded` slot instead (not tintable, per spec §10).

## Day-to-day workflows

**Change the palette / team colors** → edit `style_tokens.json`, run
`node tools/build_assets.mjs` (regenerates all SVG icons + fallback sprites
from tokens), `npm test`.

**Add a painted model** (Blender/Blockbench → glTF):
1. Export GLB to the manifest path, e.g.
   `client/assets/models/units/unit_vehicle_tank.glb` (embedded painted
   albedo, matte material per `paintedMatte` token, ≤ triBudget, name a
   `team_panel` mesh for tinting).
2. Nothing else: the resolver prefers the GLB the moment the file exists.
   (GLB loading in the renderer lands with Art Slice B/C — GLTFLoader import
   plus a preload of manifest model URLs; until then procedural stand-ins
   render.)
3. Keep `anchor_points.json` in sync if the silhouette moves the hitch/banner.

**Add a new chassis** → engine first (`engine/units.js`), then: manifest
`unit_*`/`wreck_*` entries + anchors + a factory builder (or GLB) + icons in
`tools/build_assets.mjs`. `test/art_pipeline.test.js` fails loudly on any
missing piece — that's the checklist.

**Reserved slots**: `unit_infantry_carrier`, `unit_vehicle_recovery`
(spec §8 names chassis the engine doesn't field yet; today all three chassis
tow and carry).

## What's built vs still ahead (spec §18)

| Slice | Status |
|---|---|
| A — manifest, tokens, anchors, placeholders, icons, manifest-driven renderer | **DONE** (procedural stand-ins 48–164 tris, 15-40x under budget) |
| B — Command Standard painted visuals | stand-ins done (upright/dropped/carried bob/scored tint); painted GLB + capture VFX open |
| C — core unit kit painted GLBs + wreck variants | stand-ins done incl. tow cable runtime visual; painted GLBs open |
| D — feedback kit | selection scale, order feed, cooldown HUD text exist; rings/markers per spec open |
| E — sprite fallback renderer | SVG sprites + resolver path exist; canvas renderer open |

Acceptance criteria coverage is tested in `test/art_pipeline.test.js`
(budgets, team color+symbol, state→visual mapping, resolution order, no
hardcoded paths, HTTP serving).
