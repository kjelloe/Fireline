// engine/supply.js — supply radius logic (3B)
// Bases provide a wider supply radius than relay outposts.

export function inSupply(state, asset) {
  const sites = (state.sites || []);
  for (const site of sites) {
    if (site.team !== asset.team) continue;

    const radius = (site.type === 'BASE') ? (12 * 256) : (5 * 256);
    const radiusSq = radius * radius;

    const dx = asset.x - site.x;
    const dy = asset.y - site.y;
    if (dx * dx + dy * dy <= radiusSq) return true;
  }
  return false;
}
