// engine/mines.js — Slice 9E: mines (slim model, ruling Q6).
// Bounded route denial with counterplay (spec 04 §4 mine contract): tanks
// deploy on their own cell, the mine arms after a delay, detonates on enemy
// entry (heavy damage + suppression). Owning team always sees its mines;
// enemy scouts nearby auto-MARK them (permanent team knowledge), and trucks
// clear adjacent marked mines. Bases and sites are protected no-deploy zones.
// Dependency-free on purpose — pure data helpers over state.mines.

export const MINES_PER_TANK = 2;
export const MINE_ARM_TICKS = 30;        // 3 s: no drive-by dropping under someone
export const MINE_DAMAGE = 60;           // heavy — a scout dies, a tank staggers
export const MINE_DETECT_RADIUS_CELLS = 3; // scout counterplay is local/nearby
export const MINE_CLEAR_RADIUS_CELLS = 1;  // trucks clear adjacent mines only

export function mineAt(state, cellX, cellY) {
  return state.mines.find((m) => m.cellX === cellX && m.cellY === cellY) ?? null;
}

export function isArmed(mine) {
  return mine.armTimer === 0;
}

// A mine is known to a team if it is theirs or has been marked by a scout.
export function mineVisibleTo(mine, team) {
  return mine.team === team || mine.marked === 1;
}

// Why a deploy at the asset's current cell is illegal, or null if legal.
export function deployRejection(state, asset, stats, cellX, cellY) {
  if (!stats.canMine) return "cannot deploy mines";
  if (asset.minesLeft <= 0) return "no mines left";
  if (mineAt(state, cellX, cellY)) return "mine already here";
  const inAnyBase = state.bases.some(
    (b) => cellX >= b.x && cellX < b.x + b.width &&
           cellY >= b.y && cellY < b.y + b.height
  );
  if (inAnyBase) return "cannot mine a base zone";
  if (state.sites.some((s) => s.cellX === cellX && s.cellY === cellY)) {
    return "cannot mine a site";
  }
  return null;
}

// Why this asset may not clear this mine, or null if it may. Own mines are
// always clearable; enemy mines only once marked (you must KNOW it's there).
export function clearRejection(asset, stats, mine, distanceCells) {
  if (!stats.canClearMines) return "cannot clear mines";
  if (distanceCells > MINE_CLEAR_RADIUS_CELLS) return "too far to clear";
  if (!mineVisibleTo(mine, asset.team)) return "mine not marked";
  return null;
}
