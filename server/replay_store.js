// server/replay_store.js — match history & replay persistence (slice 5A).
// Persists finished wars as {meta, commandLog} JSON files plus a browsable
// index. Replay ids derive from the log's content hash — no wall clock in
// anything replay-relevant; timestamps are caller-supplied operational data.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createByteWriter, computeFnv1a64, hashToHex64 } from "../shared/canonical.js";

function logHash(log) {
  const w = createByteWriter();
  for (const entry of log) {
    w.writeU32LE(entry.tick >>> 0);
    w.writeUtf8U16(JSON.stringify(entry.cmd));
  }
  const { hashHi, hashLo } = computeFnv1a64(w.toBytes());
  return hashToHex64(hashHi, hashLo);
}

export function createReplayStore(dir) {
  mkdirSync(dir, { recursive: true });
  const indexPath = path.join(dir, "replay_index.json");

  function readIndex() {
    if (!existsSync(indexPath)) return { replays: [] };
    return JSON.parse(readFileSync(indexPath, "utf8"));
  }

  return {
    // meta: {mapSeed, ticks, winner, reason, finalHash, finishedAt?}
    save(meta, commandLog) {
      const id = `war-${meta.mapSeed}-${logHash(commandLog).slice(0, 12)}`;
      const record = { id, meta, commandLog };
      writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(record));
      const index = readIndex();
      if (!index.replays.some((r) => r.id === id)) {
        index.replays.push({
          id,
          mapSeed: meta.mapSeed,
          ticks: meta.ticks,
          winner: meta.winner,
          reason: meta.reason,
          finalHash: meta.finalHash,
          finishedAt: meta.finishedAt ?? null,
        });
        writeFileSync(indexPath, JSON.stringify(index, null, 2));
      }
      return id;
    },

    list() {
      return readIndex().replays;
    },

    load(id) {
      if (!/^war-[0-9]+-[0-9a-f]{12}$/.test(id)) return null;
      const file = path.join(dir, `${id}.json`);
      if (!existsSync(file)) return null;
      return JSON.parse(readFileSync(file, "utf8"));
    },
  };
}
