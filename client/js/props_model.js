// client/js/props_model.js — Art round 2c (prompt 25): battlefield props
// as a PURE deterministic placement model. Terrain readability was the
// original playtest-2 complaint: forest should read as trees, rough as
// rocks, paths as trodden ground — at a glance, before color.
// Placement derives from cell coordinates only (a tiny integer hash), so
// every client sees the same forest and nothing needs the network.

const T_FOREST = 2;
const T_ROUGH = 3;
const T_PATH = 5;

// Small integer hash — NOT the engine PRNG (this is presentation, but we
// still want cross-client determinism and zero Math.random).
function cellHash(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// 14A round 2: riverline geometry (mirror of engine/riverline.js — the
// river band and bridge spans are fixed profile constants, public).
const RIVER_COLS = [60, 61, 62, 63, 64, 65, 66, 67];
const BRIDGE_ROWS = [[20, 23], [62, 65], [104, 107]];

// Props for a map: [{kind, x, y, scale, rotation}] in cell coordinates
// (x/y are cell centers plus a deterministic jitter).
export function propsFor(cells, width, height, profile = "frontier_corridor") {
  const props = [];
  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const terrain = cells[cy * width + cx];
      const h = cellHash(cx, cy);
      const jx = ((h & 0xff) / 255 - 0.5) * 0.6;
      const jy = (((h >>> 8) & 0xff) / 255 - 0.5) * 0.6;
      const rot = (((h >>> 16) & 0xff) / 255) * Math.PI * 2;
      if (terrain === T_FOREST && h % 3 === 0) {
        props.push({
          kind: "tree", x: cx + 0.5 + jx, y: cy + 0.5 + jy,
          scale: 0.7 + ((h >>> 24) & 0xff) / 255 * 0.6, rotation: rot,
        });
      } else if (terrain === T_ROUGH && h % 5 === 0) {
        props.push({
          kind: "rock", x: cx + 0.5 + jx, y: cy + 0.5 + jy,
          scale: 0.5 + ((h >>> 24) & 0xff) / 255 * 0.7, rotation: rot,
        });
      } else if (terrain === T_PATH && h % 7 === 0) {
        props.push({
          kind: "rut", x: cx + 0.5 + jx * 0.3, y: cy + 0.5 + jy * 0.3,
          scale: 0.8, rotation: rot,
        });
      }
    }
  }
  if (profile === "riverline") {
    for (let cy = 0; cy < height; cy++) {
      const onBridge = BRIDGE_ROWS.some(([a, b]) => cy >= a && cy <= b);
      for (const cx of RIVER_COLS) {
        const terrain = cells[cy * width + cx];
        if (onBridge && terrain === 1) {
          // Rails on both edges of each bridge span's outer columns.
          if (cx === RIVER_COLS[0] || cx === RIVER_COLS[RIVER_COLS.length - 1]) {
            props.push({ kind: "rail", x: cx + 0.5, y: cy + 0.5, scale: 1, rotation: 0 });
          }
        } else if (terrain === 6) { // 12C: T_WATER
          // The river itself: water sheen tiles, denser than rocks ever were.
          props.push({ kind: "water", x: cx + 0.5, y: cy + 0.5, scale: 1, rotation: 0 });
          const h = cellHash(cx, cy);
          if ((cx === RIVER_COLS[0] || cx === RIVER_COLS[RIVER_COLS.length - 1]) && h % 3 === 0) {
            props.push({
              kind: "reed", x: cx + 0.5 + ((h & 0xff) / 255 - 0.5) * 0.5, y: cy + 0.5,
              scale: 0.7 + ((h >>> 24) & 0xff) / 255 * 0.5, rotation: 0,
            });
          }
        }
      }
    }
  }
  return props;
}
