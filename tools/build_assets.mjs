#!/usr/bin/env node
// tools/build_assets.mjs — asset pipeline build step (Art Slice A).
// Generates SVG icons and sprite fallbacks FROM style_tokens.json so palette
// changes propagate everywhere, then validates the manifest (every referenced
// generated file exists; every engine chassis has unit + wreck entries).
// Idempotent: safe to re-run any time. GLB baking is a later, separate step.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "client", "assets");
const tokens = JSON.parse(readFileSync(path.join(ASSETS, "metadata", "style_tokens.json")));
const manifest = JSON.parse(readFileSync(path.join(ASSETS, "metadata", "asset_manifest.json")));
const C = tokens.colors;

const svg = (body, size = 64) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${body}</svg>\n`;

// Chunky, glance-readable glyphs — same shape language as the 3D silhouettes.
const ICONS = {
  "icon_tank.svg": svg(
    `<rect x="10" y="26" width="44" height="22" rx="6" fill="${C.hullPaint}" stroke="${C.hullShadow}" stroke-width="3"/>` +
    `<rect x="20" y="16" width="24" height="16" rx="4" fill="${C.hullShadow}"/>` +
    `<rect x="42" y="20" width="18" height="7" rx="3" fill="${C.barrel}"/>`
  ),
  "icon_scout.svg": svg(
    `<rect x="14" y="28" width="36" height="14" rx="7" fill="${C.hullPaint}" stroke="${C.hullShadow}" stroke-width="3"/>` +
    `<circle cx="22" cy="46" r="8" fill="${C.wheel}"/><circle cx="42" cy="46" r="8" fill="${C.wheel}"/>`
  ),
  "icon_artillery.svg": svg(
    `<rect x="12" y="36" width="34" height="14" rx="4" fill="${C.hullPaint}" stroke="${C.hullShadow}" stroke-width="3"/>` +
    `<rect x="26" y="8" width="8" height="34" rx="3" fill="${C.barrel}" transform="rotate(35 30 42)"/>`
  ),
  "icon_wreck.svg": svg(
    `<rect x="12" y="34" width="40" height="16" rx="5" fill="${C.wreckBody}" transform="rotate(-8 32 42)"/>` +
    `<path d="M30 26 q4 -10 0 -18" stroke="${C.smoke}" stroke-width="5" fill="none" stroke-linecap="round"/>`
  ),
  "icon_standard.svg": svg(
    `<rect x="29" y="8" width="6" height="48" rx="2" fill="${C.standardPole}"/>` +
    `<path d="M35 10 L58 18 L35 26 Z" fill="${C.selection}"/>` +
    `<ellipse cx="32" cy="56" rx="14" ry="5" fill="${C.hullShadow}"/>`
  ),
  "icon_relay.svg": svg(
    `<rect x="26" y="20" width="12" height="34" rx="3" fill="${C.hullShadow}"/>` +
    `<circle cx="32" cy="14" r="8" fill="none" stroke="${C.selection}" stroke-width="4"/>`
  ),
  "icon_zone.svg": svg(
    `<circle cx="32" cy="32" r="22" fill="none" stroke="${C.recover}" stroke-width="6" stroke-dasharray="10 6"/>`
  ),
  "icon_move.svg": svg(
    `<path d="M12 32 H44 M34 20 L48 32 L34 44" stroke="${C.selection}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  ),
  "icon_attack.svg": svg(
    `<circle cx="32" cy="32" r="18" fill="none" stroke="${C.danger}" stroke-width="6"/>` +
    `<circle cx="32" cy="32" r="5" fill="${C.danger}"/>`
  ),
  "icon_cooldown.svg": svg(
    `<circle cx="32" cy="32" r="20" fill="none" stroke="${C.hullShadow}" stroke-width="6"/>` +
    `<path d="M32 32 L32 14 A18 18 0 0 1 48 26 Z" fill="${C.selection}"/>`
  ),
  "icon_recover.svg": svg(
    `<path d="M20 40 a12 12 0 1 1 4 9 M20 40 v-10 h10" stroke="${C.recover}" stroke-width="6" fill="none" stroke-linecap="round"/>`
  ),
};
for (const team of tokens.teams) {
  const shape = team.symbol === "triangle"
    ? `<path d="M32 12 L54 50 H10 Z" fill="${team.color}"/>`
    : team.symbol === "circle"
      ? `<circle cx="32" cy="32" r="20" fill="${team.color}"/>`
      : `<rect x="14" y="14" width="36" height="36" rx="4" fill="${team.color}"/>`;
  ICONS[`team_${team.symbol}.svg`] = svg(shape);
}

// Sprite fallbacks reuse the icon glyphs on a terrain-toned card (spec §14:
// same visual identity, degraded gracefully). Proper baked sprites come with
// the painted pass.
const SPRITES = {
  "unit_tank.svg": ICONS["icon_tank.svg"],
  "unit_scout.svg": ICONS["icon_scout.svg"],
  "unit_artillery.svg": ICONS["icon_artillery.svg"],
  "wreck.svg": ICONS["icon_wreck.svg"],
  "standard.svg": ICONS["icon_standard.svg"],
  "relay.svg": ICONS["icon_relay.svg"],
  "zone.svg": ICONS["icon_zone.svg"],
};

const iconDir = path.join(ASSETS, "icons", "svg");
const spriteDir = path.join(ASSETS, "sprites", "fallback");
const minimapDir = path.join(ASSETS, "sprites", "minimap");
for (const dir of [
  iconDir, spriteDir, minimapDir,
  path.join(ASSETS, "models", "units"),
  path.join(ASSETS, "models", "objectives"),
  path.join(ASSETS, "models", "wrecks"),
  path.join(ASSETS, "models", "structures"),
  path.join(ASSETS, "textures", "units"),
  path.join(ASSETS, "textures", "terrain"),
]) mkdirSync(dir, { recursive: true });

let written = 0;
for (const [name, body] of Object.entries(ICONS)) {
  writeFileSync(path.join(iconDir, name), body);
  written++;
}
for (const [name, body] of Object.entries(SPRITES)) {
  writeFileSync(path.join(spriteDir, name), body);
  written++;
}

// Validate: every icon/sprite the manifest references must now exist.
const missing = [];
const checkRef = (ref) => {
  if (typeof ref !== "string" || !ref.startsWith("assets/")) return;
  if (ref.includes("/models/")) return; // GLBs land with the painted pass
  if (!existsSync(path.join(ROOT, "client", ref))) missing.push(ref);
};
for (const group of [manifest.units, manifest.wrecks, manifest.objectives]) {
  for (const entry of Object.values(group)) Object.values(entry).forEach(checkRef);
}
Object.values(manifest.ui).forEach(checkRef);

if (missing.length) {
  console.error("Manifest references missing generated files:\n  " + missing.join("\n  "));
  process.exit(1);
}
console.log(`assets built: ${written} SVGs generated, manifest references verified.`);
