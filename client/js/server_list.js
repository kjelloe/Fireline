// client/js/server_list.js — discovery: the global-servers rows (pure).
// Honesty over curation (specs/game-discovery.md): version-mismatched
// servers are GREYED, never hidden, with the mismatch visible; the trust
// model is the row's business to state, the renderer just draws.

export function rowsFor(servers, mine) {
  return (servers ?? []).map((s) => {
    const versionMatch = s.version === mine.version && s.fixtureVersion === mine.fixtureVersion;
    return {
      name: s.name,
      addr: s.addr,
      openSeats: s.openSeats ?? 0,
      versionMatch,
      versionHint: versionMatch ? null : `${s.version}/fx${s.fixtureVersion}`,
      freshSeconds: Math.round((s.ageMs ?? 0) / 1000),
      url: `http://${s.addr}`,
    };
  }).sort((a, b) => (b.versionMatch - a.versionMatch) || (b.openSeats - a.openSeats));
}
