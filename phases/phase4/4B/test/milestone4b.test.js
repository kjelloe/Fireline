// test/milestone4b.test.js — Milestone 4B: Audio Logic
import { test } from 'node:test';
import assert from 'node:assert';
import { AudioManager } from '../client/audio_manager.js';

test('4B audio manager maps engine events to correct sample paths', () => {
  const manager = new AudioManager({});
  const events = [
    { type: 'UNIT_FIRE', x: 100, y: 100 },
    { type: 'UNIT_DESTROYED', x: 200, y: 200 }
  ];

  const triggers = manager.processTickEvents(events);

  assert.strictEqual(triggers.length, 2);
  assert.strictEqual(triggers[0].eventName, 'fire');
  assert.match(triggers[0].path, /cannon_fire/);
  assert.strictEqual(triggers[1].eventName, 'impact');
  assert.strictEqual(triggers[1].x, 200);
});

test('4B unknown events are ignored by audio manager', () => {
    const manager = new AudioManager({});
    const triggers = manager.processTickEvents([{ type: 'UNKNOWN_TICK' }]);
    assert.strictEqual(triggers.length, 0);
});
