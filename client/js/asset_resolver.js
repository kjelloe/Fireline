// client/js/asset_resolver.js — authoritative state → visual key mapping and
// manifest access (Art Slice A). Pure and node-testable. The renderer asks
// this module WHAT to show; the manifest + factory decide HOW it looks.

const CHASSIS_NAMES = { 0: "tank", 1: "scout", 2: "artillery", 3: "logistics", 4: "carrier", 5: "bike", 6: "mortar" };
const WRECK_STATES = new Set([2, 3]); // ASSET_DISABLED, ASSET_SALVAGED

export function chassisName(type) {
  return CHASSIS_NAMES[type] ?? "tank";
}

// The single mapping every renderer (WebGL, sprite fallback, minimap) uses.
export function visualKeyFor(asset) {
  const chassis = chassisName(asset.type);
  return WRECK_STATES.has(asset.state) ? `wreck_${chassis}` : `unit_${chassis}`;
}

export function standardVisualKey(standard) {
  return standard.status === 2 ? "standard_dropped" : "standard_upright";
}

export function manifestEntry(manifest, visualKey) {
  return manifest.units?.[visualKey]
    ?? manifest.wrecks?.[visualKey]
    ?? manifest.objectives?.[visualKey]
    ?? null;
}

// Resolution order per spec §16/§14: painted GLB → procedural stand-in →
// sprite fallback. `available` is an optional predicate for model presence
// (the browser passes a preloaded-set check; tests pass fs.existsSync).
export function resolveVisual(manifest, visualKey, { available = () => false } = {}) {
  const entry = manifestEntry(manifest, visualKey);
  if (!entry) return { kind: "missing", visualKey };
  if (entry.webglModel && available(entry.webglModel)) {
    return { kind: "model", url: entry.webglModel, entry };
  }
  if (entry.procedural) {
    return { kind: "procedural", key: entry.procedural, entry };
  }
  return { kind: "sprite", url: entry.fallbackSprite, entry };
}

export function teamToken(tokens, teamId) {
  return tokens.teams.find((t) => t.id === teamId) ?? tokens.teams[0];
}
