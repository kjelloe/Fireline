// server/launch_config.js — Launch Config & Operational Grace (7E)
// Pure utility functions. No process.on, no global state, no I/O.

/**
 * Health status based on runtime metrics.
 * Thresholds: degraded >100ms lag / >512MB / snapshot >30s.
 *              down        >500ms lag / >1GB   / snapshot >120s.
 */
export function getHealth(tickLoopLagMs, memoryBytes, lastSnapshotMs, nowMs) {
  const snapshotAge = nowMs - lastSnapshotMs;
  let status = 'ok';
  if (tickLoopLagMs > 100 || memoryBytes > 512 * 1024 * 1024 || snapshotAge > 30000) {
    status = 'degraded';
  }
  if (tickLoopLagMs > 500 || memoryBytes > 1024 * 1024 * 1024 || snapshotAge > 120000) {
    status = 'down';
  }
  return { status, tickLoopLagMs, memoryBytes, snapshotAge };
}

/**
 * Build a shutdown sequence executor.
 * Stages are added as (name, async action) pairs; execute runs them
 * sequentially and captures results without stopping on error.
 */
export function createShutdownSequence() {
  const stages = [];
  return {
    addStage(name, action) {
      if (typeof name !== 'string' || typeof action !== 'function') {
        throw new Error('name must be string and action must be function');
      }
      stages.push({ name, action });
    },
    async execute(ctx) {
      const results = [];
      for (const stage of stages) {
        try {
          const result = await stage.action(ctx);
          results.push({ name: stage.name, ok: true, result });
        } catch (err) {
          results.push({ name: stage.name, ok: false, error: err.message });
        }
      }
      return results;
    }
  };
}

/**
 * Sliding-window rate-limit counter.
 * Returns an object with record(nowMs), count(nowMs), and reset().
 */
export function createRateLimit(windowMs, maxRequests) {
  if (windowMs <= 0 || maxRequests <= 0) throw new Error('windowMs and maxRequests must be > 0');
  const requests = [];
  return {
    record(nowMs) {
      requests.push(nowMs);
      const cutoff = nowMs - windowMs;
      while (requests.length > 0 && requests[0] <= cutoff) requests.shift();
      return requests.length <= maxRequests;
    },
    count(nowMs) {
      const cutoff = nowMs - windowMs;
      while (requests.length > 0 && requests[0] <= cutoff) requests.shift();
      return requests.length;
    },
    reset() { requests.length = 0; }
  };
}

// ── Deterministic FNV-1a 32-bit (used for feature-flag hashing) ────────────────────────────
function fnv1a32(str) {
  let hash = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Deterministic feature-flag rollout using FNV-1a hashing.
 * Same (flag, playerHash) always yields the same boolean.
 */
export function isFeatureEnabled(flagName, rolloutPercentage, playerIdHash) {
  if (typeof flagName !== 'string' || typeof playerIdHash !== 'string') {
    throw new Error('flagName and playerIdHash must be strings');
  }
  if (rolloutPercentage < 0 || rolloutPercentage > 100) {
    throw new Error('rolloutPercentage must be between 0 and 100');
  }
  const hash = fnv1a32(`${flagName}:${playerIdHash}`);
  const bucket = hash % 100;
  return bucket < rolloutPercentage;
}

/**
 * Extract version metadata from a manifest object (e.g. parsed package.json).
 */
export function getVersion(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('manifest must be an object');
  }
  return {
    version: manifest.version || '0.0.0',
    commit: manifest.commit || 'unknown',
    buildDate: manifest.buildDate || 'unknown'
  };
}
