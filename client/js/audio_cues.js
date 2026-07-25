// client/js/audio_cues.js — server events → positional audio cues (slice 4B).
// Pure mapping; the audio manager in client.js decides how a cue sounds.

const CELL = 256;

function assetPosition(view, assetId) {
  const all = [...(view.friendlyAssets ?? []), ...(view.visibleEnemies ?? [])];
  const found = all.find((a) => a.id === assetId);
  return found ? { x: found.x / CELL, y: found.y / CELL } : null;
}

function sitePosition(view, siteId) {
  const site = (view.sites ?? []).find((s) => s.id === siteId);
  return site ? { x: site.cellX + 0.5, y: site.cellY + 0.5 } : null;
}

// Returns [{cue, at|null}] in event order. Unknown events map to nothing.
export function mapEventsToCues(events, view) {
  const cues = [];
  for (const e of events ?? []) {
    switch (e.type) {
      case "fire_resolved":
        cues.push({ cue: "fire_cannon", at: assetPosition(view, e.attackerId) });
        break;
      case "asset_disabled":
        cues.push({ cue: "explosion", at: assetPosition(view, e.assetId) });
        break;
      case "site_captured":
        cues.push({ cue: "capture", at: sitePosition(view, e.siteId) });
        break;
      case "resupplied":
        cues.push({ cue: "resupply", at: assetPosition(view, e.assetId) });
        break;
      case "game_over":
        cues.push({ cue: "war_over", at: null });
        break;
      default:
        break;
    }
  }
  return cues;
}
