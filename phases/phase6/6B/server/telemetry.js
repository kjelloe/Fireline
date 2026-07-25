// server/telemetry.js — Performance Metrics & Match Telemetry (6B)
// Tracks match KPIs and server health for balancing and optimization.

import fs from 'fs';
import path from 'path';

const TELEMETRY_DIR = path.join(process.cwd(), 'data', 'telemetry');
if (!fs.existsSync(TELEMETRY_DIR)) fs.mkdirSync(TELEMETRY_DIR, { recursive: true });

export class TelemetryManager {
  constructor() {
    this.currentMatchId = null;
    this.events = [];
    this.startTime = 0;
  }

  startMatch(matchId) {
    this.currentMatchId = matchId;
    this.events = [];
    this.startTime = Date.now();
    this.logEvent('MATCH_START', { matchId, timestamp: this.startTime });
  }

  logEvent(type, data) {
    const event = {
      type,
      data,
      elapsed: Date.now() - this.startTime
    };
    this.events.push(event);

    // Performance: If this is an combat event, we might want it in a heatmap
    if (type === 'UNIT_KILLED') {
      this.saveToHeatmap(data.x, data.y);
    }
  }

  saveToHeatmap(x, y) {
    const heatmapFile = path.join(TELEMETRY_DIR, 'heatmap.json');
    let data = [];
    if (fs.existsSync(heatmapFile)) data = JSON.parse(fs.readFileSync(heatmapFile, 'utf8'));
    data.push({ x, y, t: Date.now() });
    fs.writeFileSync(heatmapFile, JSON.stringify(data.slice(-1000))); // Keep last 1000 kills
  }

  endMatch(result) {
    const duration = Date.now() - this.startTime;
    const log = {
      matchId: this.currentMatchId,
      duration,
      result,
      eventCount: this.events.length,
      events: this.events
    };
    const logFile = path.join(TELEMETRY_DIR, `match_${this.currentMatchId}.json`);
    fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
    this.currentMatchId = null;
    return log;
  }

  getServerHealth() {
    return {
      memory: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      uptime: process.uptime(),
      timestamp: Date.now()
    };
  }
}
