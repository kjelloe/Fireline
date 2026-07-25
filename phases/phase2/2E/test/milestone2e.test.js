// test/milestone2e.test.js — Milestone 2E: Fog-of-War Client Culling
import { test } from 'node:test';
import assert from 'node:assert';
import { createFogCuller } from '../client/fog_culler.js';

test('2E fog culler hides meshes not in view', () => {
  const culler = createFogCuller({}, {});

  const meshA = { visible: true };
  const meshB = { visible: true };

  const assetMeshes = new Map([
    [101, meshA],
    [102, meshB]
  ]);

  // View only contains asset 101
  const view = {
    assets: [{ id: 101 }],
    sites: []
  };

  culler.applyFog(assetMeshes, null, view);

  assert.strictEqual(meshA.visible, true, 'Asset in view should be visible');
  assert.strictEqual(meshB.visible, false, 'Asset not in view should be hidden');
});

test('2E fog culler handles sites correctly', () => {
    const culler = createFogCuller({}, {});
    const siteMesh = { visible: false };
    const siteMeshes = new Map([[1, siteMesh]]);

    const view = {
        assets: [],
        sites: [{ id: 1 }]
    };

    culler.applyFog(new Map(), siteMeshes, view);
    assert.strictEqual(siteMesh.visible, true, 'Site in view should become visible');
});
