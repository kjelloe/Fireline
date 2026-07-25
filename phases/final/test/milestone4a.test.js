// test/milestone4a.test.js — Milestone 4A: Tactical UI
import { test } from 'node:test';
import assert from 'node:assert';
import { drawTacticalOverlays } from '../client/ui_overlay.js';

test('4A overlay identifies selected asset for range drawing', () => {
    let drawCalls = 0;
    const mockCtx = {
        beginPath: () => {},
        arc: () => { drawCalls++; },
        fill: () => {},
        stroke: () => {}
    };
    const state = {
        assets: [{ id: 'A1', type: 'TANK', team: 0, x: 0, y: 0 }],
        sites: []
    };
    const camera = { zoom: 1 };

    drawTacticalOverlays(mockCtx, state, 'A1', camera);
    assert.ok(drawCalls >= 1, 'Should draw at least one circle for range');
});
