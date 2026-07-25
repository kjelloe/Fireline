// engine/victory.js — Victory condition checks (3E)
// Pure function: (state) -> { winner: team | null, reason: string | null }

export function checkVictory(state) {
  const assets = state.assets || [];
  const sites  = state.sites  || [];

  // 1. Annihilation: one team has no active assets remaining
  const activeByTeam = {};
  for (const a of assets) {
    if (a.status === 0) {
      activeByTeam[a.team] = (activeByTeam[a.team] || 0) + 1;
    }
  }

  const teams = [...new Set(assets.map(a => a.team))];
  for (const team of teams) {
    if (!activeByTeam[team]) {
      const winner = teams.find(t => t !== team);
      return { winner: winner ?? null, reason: 'annihilation' };
    }
  }

  // 2. Domination: one team controls all bases
  const bases = sites.filter(s => s.type === 'BASE');
  if (bases.length > 0) {
    const baseTeams = new Set(bases.map(b => b.team));
    if (baseTeams.size === 1) {
      const [winner] = baseTeams;
      return { winner, reason: 'domination' };
    }
  }

  return { winner: null, reason: null };
}
