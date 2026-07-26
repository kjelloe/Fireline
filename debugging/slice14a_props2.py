def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

# s_map carries the profile (public info — both teams know the world).
patch("engine/transport.js",
"""        session.send("s_map", {
            width: map.width,
            height: map.height,
            mapCells: Array.from(map.cells),
        });""",
"""        session.send("s_map", {
            width: map.width,
            height: map.height,
            mapCells: Array.from(map.cells),
            mapProfile: this.server.state.mapProfile, // 14A: world dressing
        });""")
patch("client/js/client.js",
"""      cachedMap = { width: msg.width, height: msg.height, cells: Uint8Array.from(msg.mapCells) };""",
"""      cachedMap = {
        width: msg.width, height: msg.height,
        cells: Uint8Array.from(msg.mapCells),
        profile: msg.mapProfile ?? "frontier_corridor",
      };""")

# props_model: profile-aware round 2 — water shading strip + bridge rails
# + reeds on riverline; relay/base dressing comes from the view side.
patch("client/js/props_model.js",
"""// Props for a map: [{kind, x, y, scale, rotation}] in cell coordinates
// (x/y are cell centers plus a deterministic jitter).
export function propsFor(cells, width, height) {""",
"""// 14A round 2: riverline geometry (mirror of engine/riverline.js — the
// river band and bridge spans are fixed profile constants, public).
const RIVER_COLS = [60, 61, 62, 63, 64, 65, 66, 67];
const BRIDGE_ROWS = [[20, 23], [62, 65], [104, 107]];

// Props for a map: [{kind, x, y, scale, rotation}] in cell coordinates
// (x/y are cell centers plus a deterministic jitter).
export function propsFor(cells, width, height, profile = "frontier_corridor") {""")
patch("client/js/props_model.js",
"""      } else if (terrain === T_PATH && h % 7 === 0) {
        props.push({
          kind: "rut", x: cx + 0.5 + jx * 0.3, y: cy + 0.5 + jy * 0.3,
          scale: 0.8, rotation: rot,
        });
      }
    }
  }
  return props;
}""",
"""      } else if (terrain === T_PATH && h % 7 === 0) {
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
        } else if (terrain === 3) {
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
}""")

# client: new prop kinds + profile pass-through + rock suppression on the
# river (water replaces them visually).
patch("client/js/client.js",
"""  const props = propsFor(cells, size, size);
  const byKind = { tree: [], rock: [], rut: [] };""",
"""  const props = propsFor(cells, size, size, cachedMap.profile);
  const byKind = { tree: [], rock: [], rut: [], water: [], rail: [], reed: [] };""")
patch("client/js/client.js",
"""    rut: () => {
      const g = new THREE.BoxGeometry(0.5, 0.02, 0.14);
      g.translate(0, 0.06, 0);
      return g;
    },
  };
  const PROP_COLOR = { tree: 0x1f3a1f, rock: 0x6a6a5e, rut: 0x574a34 };""",
"""    rut: () => {
      const g = new THREE.BoxGeometry(0.5, 0.02, 0.14);
      g.translate(0, 0.06, 0);
      return g;
    },
    water: () => {
      const g = new THREE.BoxGeometry(1, 0.04, 1);
      g.translate(0, 0.08, 0); // floats above the rough tile: reads as river
      return g;
    },
    rail: () => {
      const g = new THREE.BoxGeometry(0.12, 0.3, 1);
      g.translate(0, 0.25, 0);
      return g;
    },
    reed: () => {
      const g = new THREE.ConeGeometry(0.06, 0.5, 4);
      g.translate(0, 0.3, 0);
      return g;
    },
  };
  const PROP_COLOR = {
    tree: 0x1f3a1f, rock: 0x6a6a5e, rut: 0x574a34,
    water: 0x2a4a66, rail: 0x4a4136, reed: 0x3d5a2e,
  };""")

# Site dressing + standard plinths: static per-war group from the view.
patch("client/js/client.js",
"""function upsertSiteMesh(site) {""",
"""// 14A: one-time war dressing — antenna clutter at relays, plinths at the
// standard homes. Rebuilt when the war (terrain) changes.
let dressingGroup = null;
let dressingKey = "";
function updateWarDressing(view) {
  const key = `${cachedMap?.profile ?? ""}:${(view.sites ?? []).map((s) => s.id).join(",")}` +
    `:${(view.standards ?? []).map((st) => `${st.homeCellX},${st.homeCellY}`).join("|")}`;
  if (key === dressingKey) return;
  dressingKey = key;
  if (dressingGroup) scene.remove(dressingGroup);
  dressingGroup = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x2e2e38 });
  const pale = new THREE.MeshLambertMaterial({ color: 0x8a8a72 });
  for (const s of view.sites ?? []) {
    for (const [dx, dz, w, h] of [[-0.9, 0.4, 0.25, 0.35], [0.8, -0.6, 0.3, 0.2], [0.7, 0.7, 0.2, 0.5]]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), dark);
      crate.position.set(s.cellX + 0.5 + dx, h / 2, s.cellY + 0.5 + dz);
      dressingGroup.add(crate);
    }
  }
  for (const st of view.standards ?? []) {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 0.12, 8), pale);
    plinth.position.set(st.homeCellX + 0.5, 0.06, st.homeCellY + 0.5);
    dressingGroup.add(plinth);
  }
  scene.add(dressingGroup);
}

function upsertSiteMesh(site) {""")
patch("client/js/client.js",
"""  for (const site of view.sites ?? []) upsertSiteMesh(site);""",
"""  for (const site of view.sites ?? []) upsertSiteMesh(site);
  updateWarDressing(view);""")
print("14A patched")
