// client/scene.js — Three.js scene adapter (2C)
// Consumes interpolated VIEW frames and updates a Three.js scene graph.
// Renderer is a non-authoritative presentation adapter only.

export function createSceneAdapter(THREE, scene) {
  const assetMeshes = new Map(); // assetId -> Mesh
  const siteMeshes = new Map();  // siteId -> Mesh

  const TERRAIN_COLORS = {
    0: 0x88aa66, // OPEN — grass green
    1: 0xccbbaa, // ROAD — sandy beige
    2: 0x336633, // FOREST — dark green
    3: 0x887766, // ROUGH — brown
    4: 0x333333, // BLOCKING — dark grey
  };

  const TEAM_COLORS = {
    0: 0x4488ff, // Team 0 — blue
    1: 0xff4444, // Team 1 — red
  };

  return {
    buildTerrain(mapCells, width, height) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const terrainId = mapCells[y * width + x];
          const color = TERRAIN_COLORS[terrainId] ?? 0x888888;
          const geo = new THREE.BoxGeometry(1, 0.1, 1);
          const mat = new THREE.MeshLambertMaterial({ color });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(x, 0, y);
          scene.add(mesh);
        }
      }
    },

    updateAssets(frame) {
      if (!frame) return;
      const CELL = 256;

      const seenIds = new Set();
      for (const asset of frame.assets) {
        seenIds.add(asset.id);
        const wx = asset.x / CELL;
        const wy = asset.y / CELL;

        if (!assetMeshes.has(asset.id)) {
          const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
          const color = TEAM_COLORS[asset.team] ?? 0xffffff;
          const mat = new THREE.MeshLambertMaterial({ color });
          const mesh = new THREE.Mesh(geo, mat);
          scene.add(mesh);
          assetMeshes.set(asset.id, mesh);
        }

        const mesh = assetMeshes.get(asset.id);
        mesh.position.set(wx, 0.35, wy);
        mesh.visible = asset.status !== 'DISABLED';
      }

      // Remove meshes for assets no longer in view
      for (const [id, mesh] of assetMeshes.entries()) {
        if (!seenIds.has(id)) {
          scene.remove(mesh);
          assetMeshes.delete(id);
        }
      }

      // Enforce fog culling on existing meshes
      for (const [id, mesh] of assetMeshes.entries()) {
        mesh.visible = seenIds.has(id);
      }
    }
  };
}
