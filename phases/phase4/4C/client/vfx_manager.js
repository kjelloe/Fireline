// client/vfx_manager.js — Visual effects mapping (4C)
// Maps engine events to transient visual effect descriptors.

export class VFXManager {
  constructor() {
    this.effects = []; // Active effects with tick lifetimes
  }

  // Spawn effect descriptors based on tick events
  processTickEvents(events) {
    for (const event of (events || [])) {
      if (event.type === 'UNIT_FIRE') {
        this.effects.push({ kind: 'muzzle', x: event.x, y: event.y, life: 3 });
      }
      if (event.type === 'UNIT_DESTROYED') {
        this.effects.push({ kind: 'explosion', x: event.x, y: event.y, life: 10 });
      }
      if (event.type === 'ASSET_MOVED' && event.terrain) {
        if (event.terrain === 3 || event.terrain === 2) { // ROUGH or FOREST
          this.effects.push({ kind: 'dust', x: event.x, y: event.y, life: 5 });
        }
      }
    }
  }

  // Advance frame: decrement lifetimes, purge dead effects
  tick() {
    this.effects = this.effects.filter(e => {
      e.life -= 1;
      return e.life > 0;
    });
  }

  getActiveEffects() {
    return this.effects;
  }
}
