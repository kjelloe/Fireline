// engine/supply.js — supply radius and attrition logic (1J)

export function inSupply(state, asset) {
  const sources = (state.sites || []).filter(s => s.team === asset.team && s.type === 'relay');
  const supplyRadius = 5 * 256;
  const radiusSq = supplyRadius * supplyRadius;

  for (const src of sources) {
    const dx = asset.x - src.x;
    const dy = asset.y - src.y;
    if (dx * dx + dy * dy <= radiusSq) return true;
  }
  return false;
}
