// client/fog_culler.js — Fog-of-War Enforcement (2E)
// Ensures the Three.js scene only renders what the server snapshot allows.

export function createFogCuller(THREE, scene) {
  // We use a simple plane or mesh group to represent the "shroud"
  // For this slice, we focus on the visibility logic of existing asset/site meshes.

  return {
    applyFog(assetMeshes, siteMeshes, view) {
      if (!view) return;

      const visibleAssetIds = new Set(view.assets.map(a => a.id));
      const visibleSiteIds = new Set(view.sites.map(s => s.id));

      // 1. Hide assets not in the current snapshot's visibility list
      // Note: buildView on server already culls these from the array,
      // but we ensure the local mesh pool reflects this.
      for (const [id, mesh] of assetMeshes.entries()) {
        if (!visibleAssetIds.has(id)) {
          mesh.visible = false;
        } else {
          mesh.visible = true;
        }
      }

      // 2. Hide or "dim" sites outside visibility
      if (siteMeshes) {
        for (const [id, mesh] of siteMeshes.entries()) {
          mesh.visible = visibleSiteIds.has(id);
        }
      }
    }
  };
}
