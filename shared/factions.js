// shared/factions.js — Slice 12A: faction identity (designer ruling,
// prompt 29). IDENTITY ONLY: nothing here is hashed, nothing changes
// gameplay — this is who the teams ARE, consumed by the client and any
// future flavor system. Team 0 holds the west, team 1 the east.
// Tone directive: asymmetrically sympathetic — the Directorate feels
// necessary but cold; the Outliers feel free but volatile.

export const FACTIONS = Object.freeze({
  0: Object.freeze({
    id: 0,
    name: "The Directorate",
    short: "Directorate",
    adjective: "Directorate",
    // Slate gray + police blue, pale cyan accent; grid-shield symbol.
    colors: Object.freeze({
      primary: "#5a6472", secondary: "#4a7dc9", accent: "#bfe3e8",
    }),
    symbol: "shield",
    tacticalIdentity: "fortify · contain · stabilize",
    blurb:
      "The Directorate emerged from the old emergency command systems " +
      "after the frontier fractured. Its officers believe the region " +
      "survives only under one accountable command structure. They do " +
      "not see themselves as tyrants — they see themselves as the last " +
      "adults in the room.",
    line: "The Directorate brings order to the frontier, whether the frontier wants it or not.",
    unique: Object.freeze({ unit: "Sentinel", ability: "Deploy Hardpoint" }),
  }),
  1: Object.freeze({
    id: 1,
    name: "The Outliers",
    short: "Outliers",
    adjective: "Outlier",
    // Terracotta + sun-bleached tan, warm yellow accent; offset-arrow symbol.
    colors: Object.freeze({
      primary: "#c96a4a", secondary: "#d9c49a", accent: "#e8c95e",
    }),
    symbol: "arrow",
    tacticalIdentity: "bypass · improvise · exploit neglected routes",
    blurb:
      "The Outliers are not one army. They are crews, technicians, " +
      "settlement militias, smugglers, and defectors who operate outside " +
      "Directorate jurisdiction — because they have seen what " +
      "“stability” costs at ground level.",
    line: "The Outliers survive outside the lines — and fight to keep it that way.",
    unique: Object.freeze({ unit: "Skimmer", ability: "Riverline Drive" }),
  }),
});

export function factionFor(team) {
  return FACTIONS[team] ?? FACTIONS[0];
}
