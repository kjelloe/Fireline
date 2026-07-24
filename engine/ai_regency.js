// engine/ai_regency.js
// Deterministic AI Regency, v1 pass.
// It generates ordinary reducer commands; it never changes state directly and uses
// neither wall-clock time nor random numbers. Humans always resolve first in a tick.

import { OP_ABSENT, OP_ACTIVE, ASSET_IDLE, ASSET_DISABLED, ASSET_SALVAGED } from "./state.js";
import { CMD_JOIN_OPERATOR, CMD_SELECT_ASSET, CMD_MOVE_ORDER } from "./commands.js";

export const AI_OPERATOR_FIRST = 16;
export const AI_OPERATOR_COUNT = 8;

// One AI regent is permanently paired with each initial field asset. This keeps
// identity and decisions stable for replays, server restarts, and test harnesses.
const AGENTS = Object.freeze([
  { operatorId: 16, assetId: 0, team: 0 },
  { operatorId: 17, assetId: 1, team: 0 },
  { operatorId: 18, assetId: 2, team: 0 },
  { operatorId: 19, assetId: 3, team: 0 },
  { operatorId: 20, assetId: 4, team: 1 },
  { operatorId: 21, assetId: 5, team: 1 },
  { operatorId: 22, assetId: 6, team: 1 },
  { operatorId: 23, assetId: 7, team: 1 },
]);

// The initial doctrine is deliberately legible: advance from both base areas
// toward the corridor, then patrol the centre. Combat and path finding come later.
const TEAM_A_PATROL = Object.freeze([[48, 56], [60, 56], [64, 63], [56, 70]]);
const TEAM_B_PATROL = Object.freeze([[79, 56], [67, 56], [63, 63], [71, 70]]);

function targetFor(agent, tick) {
  const patrol = agent.team === 0 ? TEAM_A_PATROL : TEAM_B_PATROL;
  const phase = ((tick / 80) | 0) + (agent.assetId & 3);
  return patrol[phase % patrol.length];
}

export class AIRegency {
  plan(state) {
    const commands = [];
    for (const agent of AGENTS) {
      const operator = state.operators[agent.operatorId];
      const asset = state.assets[agent.assetId];

      // Claim an AI operator slot exactly once.
      if (operator.state === OP_ABSENT) {
        commands.push({ type: CMD_JOIN_OPERATOR, operatorId: agent.operatorId, team: agent.team });
        commands.push({ type: CMD_SELECT_ASSET, operatorId: agent.operatorId, assetId: agent.assetId });
        continue;
      }

      // The assigned asset may be occupied by a human. AI does not evict people,
      // steal team-mates' assets, or issue commands for an asset it does not operate.
      if (operator.state !== OP_ACTIVE || asset.operatorId !== agent.operatorId) continue;
      if (asset.state !== ASSET_IDLE || asset.state === ASSET_DISABLED || asset.state === ASSET_SALVAGED) continue;

      const [targetCellX, targetCellY] = targetFor(agent, state.tick);
      const currentCellX = (asset.x / 256) | 0;
      const currentCellY = (asset.y / 256) | 0;
      if (currentCellX !== targetCellX || currentCellY !== targetCellY) {
        commands.push({ type: CMD_MOVE_ORDER, operatorId: agent.operatorId, targetCellX, targetCellY });
      }
    }
    return commands;
  }
}
