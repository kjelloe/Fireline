// engine/downed.js — downed operators on foot (slice 9B, ruling Q3: full
// walking operator_foot). When a crewed asset is disabled its crew bails out
// as a downed operator: crawl to cover, call for help, redeploy after a
// delay, get rescued by a Command Carrier, or auto-return. Enemies cannot
// target downed operators (follow-up ruling 1). Pure helpers; reducer owns
// all mutation.

import { worldToCellFloor, absI32 } from "../shared/fixedmath.js";

export const OPERATOR_SPEED = 6;              // fixed units/tick — a crawl
export const CRAWL_RADIUS_CELLS = 3;          // "move minimally to cover"
export const REDEPLOY_TICKS = 100;            // ~10 s before fast redeploy
export const OPERATOR_AUTO_RETURN_TICKS = 600; // ~60 s to walk home off-screen

export function createDowned(operator, asset) {
  return {
    operatorId: operator.id,
    team: operator.team,
    x: asset.x,
    y: asset.y,
    targetX: asset.x,
    targetY: asset.y,
    downTicks: 0,
  };
}

export function downedFor(state, operatorId) {
  return state.downed.find((d) => d.operatorId === operatorId) ?? null;
}

export function crawlRejection(downed, targetCellX, targetCellY) {
  if (!downed) return "not downed";
  const dx = absI32(targetCellX - worldToCellFloor(downed.x));
  const dy = absI32(targetCellY - worldToCellFloor(downed.y));
  if (dx + dy > CRAWL_RADIUS_CELLS) return "too far to crawl";
  return null;
}

// A carrier with a free bunk adjacent to a friendly downed operator.
// 11G: manual seats (autoRescue off) are skipped by the automatic pass —
// they climb aboard with an explicit board_carrier command instead.
export function boardableBy(state, carrier, { manualToo = false } = {}) {
  if (carrier.aboard1 !== -1 && carrier.aboard2 !== -1) return null;
  const cx = worldToCellFloor(carrier.x);
  const cy = worldToCellFloor(carrier.y);
  return state.downed.find((d) => {
    if (d.team !== carrier.team) return false;
    if (!manualToo && state.operators[d.operatorId]?.autoRescue === 0) return false;
    const dx = absI32(worldToCellFloor(d.x) - cx);
    const dy = absI32(worldToCellFloor(d.y) - cy);
    return (dx > dy ? dx : dy) <= 1;
  }) ?? null;
}
