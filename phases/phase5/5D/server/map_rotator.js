// server/map_rotator.js — Map rotation & biomes (5C)
// Cycles through map seeds and terrain palettes.

const BIOMES = [
  { id: 'temperate', roughFraction: 0.15, forestFraction: 0.20, roadCount: 4 },
  { id: 'arctic',    roughFraction: 0.05, forestFraction: 0.00, roadCount: 2, iceMode: true },
  { id: 'desert',    roughFraction: 0.25, forestFraction: 0.05, roadCount: 3 }
];

const ROTATION_INTERVAL = 30 * 60 * 1000; // 30 minutes

export class MapRotator {
  constructor() {
    this.index = 0;
    this.lastRotation = 0;
    this.currentBiome = BIOMES[0];
  }

  getCurrentMapOptions(now = Date.now()) {
    if (now - this.lastRotation >= ROTATION_INTERVAL) {
      this.index = (this.index + 1) % BIOMES.length;
      this.currentBiome = BIOMES[this.index];
      this.lastRotation = now;
    }
    return { ...this.currentBiome, seed: Math.floor(now / ROTATION_INTERVAL) };
  }

  forceBiome(biomeId) {
    const found = BIOMES.find(b => b.id === biomeId);
    if (found) {
      this.currentBiome = found;
      this.lastRotation = Date.now();
    }
  }
}

export { BIOMES };
