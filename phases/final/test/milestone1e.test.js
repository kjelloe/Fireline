// test/milestone1e.test.js — Milestone 1E: Command Validation
import { test } from 'node:test';
import assert from 'node:assert';
import { validate, CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER } from '../engine/commands.js';

test('1E validate rejects missing type', () => {
  assert.strictEqual(validate(null).ok, false);
  assert.strictEqual(validate({}).ok, false);
});

test('1E validate accepts advance_tick', () => {
  assert.strictEqual(validate({ type: 'advance_tick' }).ok, true);
});

test('1E validate join_operator with valid id', () => {
  assert.strictEqual(validate({ type: 'join_operator', operatorId: 5 }).ok, true);
});

test('1E validate join_operator rejects invalid id', () => {
  assert.strictEqual(validate({ type: 'join_operator', operatorId: -1 }).ok, false);
  assert.strictEqual(validate({ type: 'join_operator', operatorId: 32 }).ok, false);
});

test('1E validate select_asset with valid ids', () => {
  assert.strictEqual(validate({ type: 'select_asset', operatorId: 0, assetId: 1 }).ok, true);
});

test('1E validate move_order with valid coords', () => {
  assert.strictEqual(validate({ type: 'move_order', assetId: 1, x: 10, y: 10 }).ok, true);
});

test('1E validate move_order rejects out of bounds', () => {
  assert.strictEqual(validate({ type: 'move_order', assetId: 1, x: 128, y: 10 }).ok, false);
});
