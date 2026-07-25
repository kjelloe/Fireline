// engine/ai_regent.js — Milestone 1D/1F
// 8 autonomous AI regents. Deterministic planning, no randomness.

const WAYPOINTS = {
  0: [{ x: 32, y: 56 }, { x: 64, y: 56 }, { x: 96, y: 56 }],
  1: [{ x: 96, y: 56 }, { x: 64, y: 56 }, { x: 32, y: 56 }],
};

export class AiRegent {
  constructor(operatorId, assetId, team) {
    this.operatorId  = operatorId;
    this.assetId     = assetId;
    this.team        = team;
    this.waypointIdx = 0;
    this.joined      = false;
    this.selected    = false;
  }

  decide(state) {
    const commands = [];

    if (!this.joined) {
      commands.push({ type: "join_operator", operatorId: this.operatorId, team: this.team });
      this.joined = true;
      return commands;
    }

    if (!this.selected) {
      const op = state.operators[this.operatorId];
      if (op) {
        commands.push({ type: "select_asset", operatorId: this.operatorId, assetId: this.assetId });
        this.selected = true;
      }
      return commands;
    }

    const op = state.operators[this.operatorId];
    if (!op || op.assetId === null) return commands;

    const asset = state.assets[op.assetId];
    if (!asset) return commands;

    const wps = WAYPOINTS[this.team];
    const wp  = wps[this.waypointIdx % wps.length];

    const dx = Math.abs(asset.x - wp.x);
    const dy = Math.abs(asset.y - wp.y);
    if (dx < 1 && dy < 1) {
      this.waypointIdx++;
    } else {
      commands.push({
        type: "move_order",
        operatorId: this.operatorId,
        targetCellX: wp.x,
        targetCellY: wp.y,
      });
    }

    return commands;
  }
}

export function createRegents() {
  const regents = [];
  // 4 per team, operator IDs 100-107, asset IDs 0-7
  for (let i = 0; i < 4; i++) {
    regents.push(new AiRegent(100 + i, i, 0));
  }
  for (let i = 0; i < 4; i++) {
    regents.push(new AiRegent(104 + i, 4 + i, 1));
  }
  return regents;
}
