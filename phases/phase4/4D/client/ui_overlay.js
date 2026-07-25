// client/ui_overlay.js — Tactical UX Overlays (4A)
// Visualizes ranges and supply logic for the human player.

export function drawTacticalOverlays(ctx, state, selectedId, camera) {
  if (!state || !selectedId) return;

  const asset = state.assets.find(a => a.id === selectedId);
  if (!asset) return;

  // Convert game coordinates to screen coordinates (simplified for 2.5D)
  const screenPos = worldToScreen(asset.x, asset.y, camera);

  // 1. Draw Range Circle
  const range = (asset.type === 'ARTILLERY') ? 12 * 256 : 5 * 256;
  drawCircle(ctx, screenPos, range * camera.zoom, 'rgba(255, 0, 0, 0.2)', 'red');

  // 2. Draw Supply Visuals for all friendly sites
  (state.sites || []).forEach(site => {
    if (site.team === asset.team) {
      const sitePos = worldToScreen(site.x, site.y, camera);
      const radius = (site.type === 'BASE') ? 12 * 256 : 5 * 256;
      drawCircle(ctx, sitePos, radius * camera.zoom, 'rgba(0, 255, 0, 0.05)', 'green');
    }
  });
}

function worldToScreen(x, y, camera) {
    // This is a placeholder for the actual Three.js projector logic
    // In the actual client, this uses camera.project(vector)
    return { x: (x / 256) * 10, y: (y / 256) * 10 }; 
}

function drawCircle(ctx, pos, radius, fill, stroke) {
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
}
