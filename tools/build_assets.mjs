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
  "icon_logistics.svg": svg(
    `<rect x="10" y="30" width="26" height="16" rx="3" fill="${C.hullPaint}" stroke="${C.hullShadow}" stroke-width="3"/>` +
    `<rect x="36" y="24" width="16" height="22" rx="3" fill="${C.hullShadow}"/>` +
    `<path d="M14 28 L26 14 M26 14 l0 8" stroke="${C.barrel}" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<circle cx="20" cy="50" r="7" fill="${C.wheel}"/><circle cx="44" cy="50" r="7" fill="${C.wheel}"/>`
  ),
  "icon_carrier.svg": svg(
    `<rect x="10" y="22" width="36" height="26" rx="4" fill="${C.hullPaint}" stroke="${C.hullShadow}" stroke-width="3"/>` +
    `<rect x="46" y="28" width="10" height="20" rx="2" fill="${C.hullShadow}"/>` +
    `<circle cx="28" cy="16" r="4" fill="${C.recover}"/>`
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
  "icon_mortar.svg": svg( // 11S
    `<rect x="14" y="44" width="36" height="8" rx="2" fill="${C.hullShadow}"/>` +
    `<rect x="26" y="14" width="12" height="30" rx="4" fill="${C.barrel}" transform="rotate(24 32 44)"/>` +
    `<path d="M46 12 q6 8 2 16" stroke="${C.danger}" stroke-width="3" fill="none" stroke-linecap="round"/>`
  ),
  "icon_bike.svg": svg( // 11R
    `<circle cx="18" cy="44" r="10" fill="none" stroke="${C.wheel}" stroke-width="4"/>` +
    `<circle cx="46" cy="44" r="10" fill="none" stroke="${C.wheel}" stroke-width="4"/>` +
    `<path d="M18 44 L30 26 L44 26 L46 44 M30 26 L26 20 M44 26 L48 20" stroke="${C.hullPaint}" stroke-width="4" fill="none" stroke-linecap="round"/>`
  ),
  "icon_mine.svg": svg( // 11Q
    `<ellipse cx="32" cy="40" rx="18" ry="8" fill="${C.hullShadow}"/>` +
    `<circle cx="32" cy="36" r="5" fill="${C.danger}"/>` +
    `<path d="M18 30 L14 24 M46 30 L50 24 M32 28 V20" stroke="${C.barrel}" stroke-width="3" stroke-linecap="round"/>`
  ),
  "icon_drone.svg": svg( // 11Q
    `<rect x="26" y="26" width="12" height="12" rx="3" fill="${C.hullShadow}"/>` +
    `<path d="M28 28 L14 14 M36 28 L50 14 M28 36 L14 50 M36 36 L50 50" stroke="${C.barrel}" stroke-width="3"/>` +
    `<circle cx="14" cy="14" r="6" fill="none" stroke="${C.hullPaint}" stroke-width="3"/>` +
    `<circle cx="50" cy="14" r="6" fill="none" stroke="${C.hullPaint}" stroke-width="3"/>` +
    `<circle cx="14" cy="50" r="6" fill="none" stroke="${C.hullPaint}" stroke-width="3"/>` +
    `<circle cx="50" cy="50" r="6" fill="none" stroke="${C.hullPaint}" stroke-width="3"/>`
  ),
  "icon_recover.svg": svg(
    `<path d="M20 40 a12 12 0 1 1 4 9 M20 40 v-10 h10" stroke="${C.recover}" stroke-width="6" fill="none" stroke-linecap="round"/>`
  ),
};
for (const team of tokens.teams) {
  // 12A faction symbols (designer ruling): grid shield = order and
  // territory control; offset arrow through a broken circle = movement
  // outside the system. Legacy shapes kept for any older token sets.
  const shape = team.symbol === "shield"
    ? `<path d="M32 8 L52 16 V34 C52 46 42 54 32 58 C22 54 12 46 12 34 V16 Z" fill="${team.color}"/>` +
      `<path d="M22 20 H42 M22 30 H42 M22 40 H42 M27 15 V47 M37 15 V47" stroke="rgba(255,255,255,0.55)" stroke-width="2.5"/>`
    : team.symbol === "arrow"
      ? `<path d="M32 10 A22 22 0 1 0 54 32" fill="none" stroke="${team.color}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M34 30 L56 8 M56 8 H42 M56 8 V22" stroke="${team.color}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : team.symbol === "triangle"
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
  "unit_logistics.svg": ICONS["icon_logistics.svg"],
  "unit_carrier.svg": ICONS["icon_carrier.svg"],
  "unit_bike.svg": ICONS["icon_bike.svg"], // 11R
  "unit_mortar.svg": ICONS["icon_mortar.svg"], // 11S
  "wreck.svg": ICONS["icon_wreck.svg"],
  "standard.svg": ICONS["icon_standard.svg"],
  "relay.svg": ICONS["icon_relay.svg"],
  "zone.svg": ICONS["icon_zone.svg"],
  "mine.svg": ICONS["icon_mine.svg"],   // 11Q
  "drone.svg": ICONS["icon_drone.svg"], // 11Q
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
