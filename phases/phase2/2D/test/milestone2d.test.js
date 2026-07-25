// test/milestone2d.test.js — Milestone 2D: Command Dispatch
import { test } from 'node:test';
import assert from 'node:assert';
import { createInputHandler } from '../client/input_handler.js';

test('2D input handler manages selection state', () => {
  const handler = createInputHandler({Vector2: class{}, Raycaster: class{}}, {}, {}, {});
  handler.setSelected(5);
  assert.strictEqual(handler.getSelected(), 5);
});

test('2D input handler format MOVE command correctly', () => {
  // Mock THREE for raycasting
  const MockTHREE = {
    Vector2: class { set() {} },
    Raycaster: class { 
      setFromCamera() {} 
      intersectObjects() { return [{ point: { x: 5, z: 10 } }]; }
    }
  };

  const handler = createInputHandler(MockTHREE, {}, {}, {});
  handler.setSelected(1);

  const cmd = handler.handlePointerDown({ clientX: 0, clientY: 0 }, { children: [] }, 'p1');

  assert.strictEqual(cmd.type, 'MOVE');
  assert.strictEqual(cmd.target.x, 5 * 256);
  assert.strictEqual(cmd.target.y, 10 * 256);
});
