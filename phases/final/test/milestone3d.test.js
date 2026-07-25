// test/milestone3d.test.js — Milestone 3D: Advanced Combat
import { test } from 'node:test';
import assert from 'node:assert';
import { canFire } from '../engine/combat.js';

test('3D artillery has superior range to tanks', () => {
    const state = { sites: [{ team: 0, type: 'BASE', x: 0, y: 0 }] }; // For supply
    const arty = { id: 'A1', type: 'ARTILLERY', team: 0, x: 0, y: 0, status: 0 };
    const tank = { id: 'A2', type: 'TANK', team: 0, x: 0, y: 0, status: 0 };

    // Target is 10 cells away
    const target = { id: 'E1', type: 'TANK', team: 1, x: 10 * 256, y: 0, status: 0 };

    assert.strictEqual(canFire(state, arty, target), true, 'Artillery should hit at 10 cells');
    assert.strictEqual(canFire(state, tank, target), false, 'Tank should fail at 10 cells');
});

test('3D units cannot fire without supply', () => {
    const state = { sites: [] }; // No supply sources
    const arty = { id: 'A1', type: 'ARTILLERY', team: 0, x: 0, y: 0, status: 0 };
    const target = { id: 'E1', type: 'TANK', team: 1, x: 256, y: 0, status: 0 };

    assert.strictEqual(canFire(state, arty, target), false, 'Out-of-supply units cannot fire');
});
