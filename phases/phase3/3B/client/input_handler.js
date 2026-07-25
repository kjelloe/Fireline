// client/input_handler.js — Command Dispatch (2D)
// Translates raw DOM/Three.js events into deterministic game commands.

export function createInputHandler(THREE, camera, renderer, sceneAdapter) {
  let selectedAssetId = null;

  return {
    handlePointerDown(event, scene, opId) {
      // 1. Raycast to find what was clicked
      const mouse = new THREE.Vector2(
        (event.clientX / (globalThis.innerWidth || 800)) * 2 - 1,
        -(event.clientY / (globalThis.innerHeight || 600)) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length === 0) return null;

      const hit = intersects[0];
      const CELL = 256;
      const targetX = Math.round(hit.point.x);
      const targetY = Math.round(hit.point.z);

      // 2. Logic: If clicking an asset, select it. If clicking ground, move/fire.
      // For this simplified slice, we use a simple state machine:
      // - First click: Select asset ID
      // - Second click on ground: MOVE command
      // - Second click on enemy: FIRE command

      // In a real implementation, we'd query the current Frame/View to see 
      // if an asset mesh was hit.

      return {
        type: 'MOVE',
        opId: opId,
        assetId: selectedAssetId || 0, // Placeholder selection logic
        target: { x: targetX * CELL, y: targetY * CELL }
      };
    },

    getSelected() { return selectedAssetId; },
    setSelected(id) { selectedAssetId = id; }
  };
}
