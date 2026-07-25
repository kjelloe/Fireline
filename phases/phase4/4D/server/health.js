// server/health.js — Server health diagnostics (4D)
// Pure function: is the simulation loop alive?

export function getHealthStatus(lastTickTime, now = Date.now()) {
  const delta = now - lastTickTime;
  return {
    status: (delta < 2000) ? 'healthy' : 'unhealthy',
    tickDelta: delta
  };
}

export function getLoadMetrics(commandQueueDepth, playerCount) {
  return {
    queueDepth: commandQueueDepth,
    connections: playerCount,
    overloaded: commandQueueDepth > 100
  };
}
