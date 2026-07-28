// client/js/props_model.js — Art round 2c (prompt 25): battlefield props
// as a PURE deterministic placement model. Terrain readability was the
// original playtest-2 complaint: forest should read as trees, rough as
// rocks, paths as trodden ground — at a glance, before color.
// Placement derives from cell coordinates only (a tiny integer hash), so
// every client sees the same forest and nothing needs the network.

const T_FOREST = 2;
const T_ROUGH = 3;
const T_BLOCKING = 4; // 18C
const T_PATH = 5;

// 14G: the base compound — buildings laid out relative to the base rect,
// mirrored for the east side so both headquarters face the front line.
// [{kind, x, y, rotation, scale}] in cell coordinates.
export function baseCompound(base, eastSide = false) {
  // Fractions of the rect: [kind, fx, fy, rot, scale]. fx measured from
  // the FRONT edge (the side facing mid-map), so mirroring is exact.
  const LAYOUT = [
    ["hq", 0.75, 0.28, 0, 1],
    // Playtest-7 item 13: the supply DEPOT sits at the base center — the
    // exact cell rebuilds spawn at and hauls drop to (the item-18 golden
    // ring lands on its doorstep). Crates make "resupply here" legible.
    ["warehouse", 0.5, 0.5, 0, 1],
    ["crates", 0.42, 0.42, 0, 1],
    ["crates", 0.58, 0.6, 0, 1],
    ["shed", 0.72, 0.62, 0, 1],
    ["shed", 0.72, 0.82, 0, 1],
    ["tank_fuel", 0.88, 0.5, 0, 1],
    ["tank_fuel", 0.88, 0.58, 0, 1],
    ["mast", 0.85, 0.15, 0, 1],
    ["pad", 0.45, 0.72, 0, 1],
    ["post", 0.05, 0.05, 0, 1],
    ["post", 0.05, 0.95, 0, 1],
    ["post", 0.95, 0.05, 0, 1],
    ["post", 0.95, 0.95, 0, 1],
  ];
  return LAYOUT.map(([kind, fx, fy, rotation, scale]) => ({
    kind,
    x: base.x + (eastSide ? fx : 1 - fx) * base.width,
    y: base.y + fy * base.height,
    rotation: eastSide ? rotation : -rotation,
    scale,
  }));
}

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
      } else if (terrain === 1 && h % 4 === 0) {
        // 14G: worn center-line dashes make the road READ as a road.
        props.push({ kind: "dash", x: cx + 0.5, y: cy + 0.5, scale: 1, rotation: 0 });
      } else if (terrain === T_FOREST && h % 3 === 1) {
        // 14G: undergrowth between the trees — forests get depth.
        props.push({
          kind: "bush", x: cx + 0.5 + jx, y: cy + 0.5 + jy,
          scale: 0.4 + ((h >>> 24) & 0xff) / 255 * 0.3, rotation: rot,
        });
      } else if (terrain === T_BLOCKING) {
        // 18C: impassable ground must LOOK impassable. Units stall
        // silently at a mesa face (the wall rule), so a flat dark tile
        // reads as a bug — every blocking cell carries rock mass.
        props.push({
          kind: "rock", x: cx + 0.5 + jx, y: cy + 0.5 + jy,
          scale: 1.6 + ((h >>> 24) & 0xff) / 255 * 0.8, rotation: rot,
        });
      } else if (terrain === T_PATH && h % 7 === 0) {
        props.push({
          kind: "rut", x: cx + 0.5 + jx * 0.3, y: cy + 0.5 + jy * 0.3,
          scale: 0.8, rotation: rot,
        });
      }
    }
  }
  return props.concat(profile === "riverline" ? riverDressing(cells, width, height) : []);
}

function riverDressing(cells, width, height) {
  const props = [];
  if (true) {
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
