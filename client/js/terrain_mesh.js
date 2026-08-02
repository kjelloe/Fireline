// client/js/terrain_mesh.js — TERRAIN MESH V2 (prompt 157, art phase 1).
// One vertex-colored ground mesh replaces the per-cell flat boxes:
// smooth color BLENDING at terrain borders, sand banding where land
// meets water, SEMANTIC micro-relief only (water sinks, rough bumps,
// forest undulates gently — nothing that lies about LOS or passability:
// gameplay is flat 2D cells and stays that way), and cheap baked
// vertex AO near walls and forest mass. Everything derives from
// (cells, mapSeed) — the 16G/ambients precedent: replays, fog, and
// balance never notice. Walls (T_BLOCKING) keep their instanced boxes
// on top; props ride the relief via heightAt.

// Terrain ids (engine/mapgen.js): 0 open, 1 road, 2 forest, 3 rough,
// 4 blocking, 5 path, 6 water.

const REL = Object.freeze({
  0: 0.0, 1: 0.02, 2: 0.06, 3: 0.05, 4: 0.0 /* boxes own walls */, 5: 0.03, 6: -0.16,
});
const NOISE_AMP = Object.freeze({ 0: 0.05, 1: 0.0, 2: 0.09, 3: 0.12, 4: 0, 5: 0.02, 6: 0.02 });

export function hash2(seed, a, b) {
  let h = (seed ^ (a * 0x9e3779b1) ^ (b * 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

function cellAt(cells, size, x, y) {
  const cx = Math.max(0, Math.min(size - 1, x));
  const cy = Math.max(0, Math.min(size - 1, y));
  return cells[cy * size + cx];
}

// Presentation height of the VERTEX at lattice point (x, y) — the mean
// of its four touching cells' relief plus seeded micro-noise. Water
// stays a flat basin (its own noise is in the sheen, not the bed).
export function heightAt(cells, size, seed, x, y) {
  let rel = 0;
  let amp = 0;
  let water = 0;
  for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
    const t = cellAt(cells, size, x + dx, y + dy);
    rel += REL[t] ?? 0;
    amp += NOISE_AMP[t] ?? 0;
    if (t === 6) water++;
  }
  rel /= 4; amp /= 4;
  if (water === 4) return REL[6]; // open water: a flat bed
  const n = hash2(seed, x, y) - 0.5;
  return rel + n * amp;
}

// Vertex color = the blend of the four touching cells' palette colors,
// with SAND BANDING on land vertices that touch water, and vertex AO
// where walls/forest mass crowds in.
export function colorAt(cells, size, seed, x, y, palette, sand) {
  let r = 0, g = 0, b = 0;
  let water = 0, wall = 0, forest = 0;
  for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
    const t = cellAt(cells, size, x + dx, y + dy);
    const c = palette[t] ?? palette[0];
    r += c[0]; g += c[1]; b += c[2];
    if (t === 6) water++;
    if (t === 4) wall++;
    if (t === 2) forest++;
  }
  r /= 4; g /= 4; b /= 4;
  if (water > 0 && water < 4) {
    // The beach: blend toward sand, stronger the more land remains.
    const k = 0.55;
    r = r * (1 - k) + sand[0] * k;
    g = g * (1 - k) + sand[1] * k;
    b = b * (1 - k) + sand[2] * k;
  }
  // Baked AO: walls and deep forest shade their verges.
  const ao = 1 - 0.10 * wall - 0.045 * Math.max(0, forest - 1);
  // A whisper of seeded tonal variation so open ground reads as ground.
  const tone = 1 + (hash2(seed ^ 0x51ce, x, y) - 0.5) * 0.07;
  return [r * ao * tone, g * ao * tone, b * ao * tone];
}

// Build the THREE mesh group. `palette` maps terrain id -> [r,g,b] 0..1.
export function buildTerrainMesh(THREE, cachedMap, palette, sand = [0.76, 0.70, 0.52]) {
  const size = cachedMap.width;
  const cells = cachedMap.cells;
  const seed = cachedMap.seed >>> 0;
  const geo = new THREE.PlaneGeometry(size, size, size, size);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    // After rotateX, x runs -size/2..size/2 and z runs -size/2..size/2.
    const vx = Math.round(pos.getX(i) + size / 2);
    const vz = Math.round(pos.getZ(i) + size / 2);
    pos.setY(i, heightAt(cells, size, seed, vx, vz));
    const [r, g, b] = colorAt(cells, size, seed, vx, vz, palette, sand);
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.position.set(size / 2, 0, size / 2);
  const group = new THREE.Group();
  group.add(mesh);
  // The water sheen: one translucent plane just above the basins,
  // opacity pulsed by the render loop (visual only).
  let hasWater = false;
  for (let i = 0; i < cells.length; i++) if (cells[i] === 6) { hasWater = true; break; }
  if (hasWater) {
    const sheen = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ color: 0x3d6fb6, transparent: true, opacity: 0.35, depthWrite: false })
    );
    sheen.rotation.x = -Math.PI / 2;
    sheen.position.set(size / 2, -0.06, size / 2);
    sheen.name = "water-sheen";
    group.add(sheen);
  }
  return group;
}
