# Slice 15B part 2: describeEvent + win reasons + end screen + briefing
# extracted through t(). Norwegian for every new key; parity test guards.

def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:70]!r}"
    open(path, "w").write(src.replace(old, new))

EN = """    // ── event feed lines (15B part 2) ──
    "ev.operator_unboarded": "Operator {id} hopped off.",
    "ev.site_shelled": "Relay {id} under artillery fire!",
    "ev.site_damaged": "Relay {id} is DOWN — a truck with materiel can rebuild it.",
    "ev.site_repaired": "Relay {id} rebuilt and humming.",
    "ev.site_neutralized_us": "Relay {id} neutralized — hold to capture!",
    "ev.site_neutralized_them": "Relay {id} is being taken — defend it!",
    "ev.site_captured_us": "Relay {id} secured.",
    "ev.site_captured_them": "Relay {id} lost to the enemy!",
    "ev.asset_disabled": "Asset {id} disabled.",
    "ev.mine_deployed": "Mine laid ({n} left in the rack).",
    "ev.mine_marked": "Scouts marked an enemy mine.",
    "ev.mine_detonated": "MINE! Asset {id} hit.",
    "ev.mine_cleared": "Mine cleared by asset {id}.",
    "ev.ping": "[PING] {label} @ ({x},{y})",
    "ev.drone_launched": "DRONE UP — someone idled too long off supply. Move or shoot it down.",
    "ev.drone_hit": "Drone stinging asset {id} — move!",
    "ev.drone_downed": "Drone downed by asset {id}.",
    "ev.drone_recalled": "The drone broke off.",
    "ev.resupplied": "Asset {id} resupplied.",
    "ev.standard_taken_us": "WE HAVE THEIR STANDARD! Escort it home!",
    "ev.standard_taken_them": "THEY TOOK OUR STANDARD! Stop the carrier!",
    "ev.standard_dropped": "The standard is down — race for it!",
    "ev.standard_returned_us": "Our standard is safe at base.",
    "ev.standard_returned_them": "Enemy standard recovered to their base.",
    "ev.standard_scored_us": "STANDARD CAPTURED — VICTORY!",
    "ev.standard_scored_them": "Enemy scored our standard.",
    "ev.operator_downed": "Operator {id} is DOWN — crawl to cover, redeploy, or await a carrier.",
    "ev.operator_rescued": "Carrier {by} picked up operator {id}!",
    "ev.operator_delivered": "Operator {id} delivered safe — take a new asset.",
    "ev.operator_redeployed": "Operator {id} redeployed — take a new asset.",
    "ev.operator_returned": "Operator {id} made it back on foot.",
    "ev.tow_started": "Asset {by} is towing wreck {id}.",
    "ev.recovery_started": "Wreck {id} in the repair bay.",
    "ev.asset_restored": "Asset {id} restored to duty!",
    "ev.asset_manufactured": "Home base rebuilt asset {id} — reinforcements!",
    // ── end screen ──
    "end.victory": "VICTORY",
    "end.defeat": "DEFEAT",
    "end.draw": "DRAW",
    "end.next_war": "Next war begins in ~{s}s — stay in your seat.",
    "end.honors": "HONORS",
    "win.elimination": "the enemy force was eliminated",
    "win.domination": "every relay held long enough — total domination",
    "win.points": "the war clock ran out — points decided it",
    "win.standard": "the Command Standard was captured",
    "win.unknown": "unknown",
    // ── briefing ──
    "brief.fight_for": "You fight for {name}.",
    "brief.win": "WIN: a COMMAND CARRIER must take the enemy standard (tall banner) home while your own standard is safe. Trucks tow wrecks; everyone escorts.",
    "brief.relays": "RELAYS (masts on the road) project supply — out of supply you crawl and cannot fire.",
    "brief.fog": "Enemies are hidden by fog until your units get close. Wrecks can be towed home and repaired.",
    "brief.clicks": "Click: your unit = take it · ground = move · enemy = fire · friendly wreck = tow.",
"""

NO = """    "ev.operator_unboarded": "Operatør {id} hoppet av.",
    "ev.site_shelled": "Relé {id} under artilleriild!",
    "ev.site_damaged": "Relé {id} er NEDE — en lastebil med materiell kan gjenoppbygge det.",
    "ev.site_repaired": "Relé {id} gjenoppbygd og i drift.",
    "ev.site_neutralized_us": "Relé {id} nøytralisert — hold stand for å ta det!",
    "ev.site_neutralized_them": "Relé {id} er i ferd med å bli tatt — forsvar det!",
    "ev.site_captured_us": "Relé {id} sikret.",
    "ev.site_captured_them": "Relé {id} tapt til fienden!",
    "ev.asset_disabled": "Enhet {id} slått ut.",
    "ev.mine_deployed": "Mine lagt ({n} igjen i stativet).",
    "ev.mine_marked": "Speiderne merket en fiendtlig mine.",
    "ev.mine_detonated": "MINE! Enhet {id} truffet.",
    "ev.mine_cleared": "Mine ryddet av enhet {id}.",
    "ev.ping": "[PING] {label} @ ({x},{y})",
    "ev.drone_launched": "DRONE I LUFTA — noen sto for lenge uten forsyning. Flytt deg eller skyt den ned.",
    "ev.drone_hit": "Dronen stikker enhet {id} — flytt deg!",
    "ev.drone_downed": "Drone skutt ned av enhet {id}.",
    "ev.drone_recalled": "Dronen brøt av.",
    "ev.resupplied": "Enhet {id} etterforsynt.",
    "ev.standard_taken_us": "VI HAR STANDARTEN DERES! Eskorter den hjem!",
    "ev.standard_taken_them": "DE TOK STANDARTEN VÅR! Stopp vognen!",
    "ev.standard_dropped": "Standarten ligger nede — kappløp om den!",
    "ev.standard_returned_us": "Standarten vår er trygg i basen.",
    "ev.standard_returned_them": "Fiendens standart berget hjem til dem.",
    "ev.standard_scored_us": "STANDART EROBRET — SEIER!",
    "ev.standard_scored_them": "Fienden vant med standarten vår.",
    "ev.operator_downed": "Operatør {id} er NEDE — kryp i dekning, redeploy, eller vent på en vogn.",
    "ev.operator_rescued": "Vogn {by} plukket opp operatør {id}!",
    "ev.operator_delivered": "Operatør {id} levert trygt — ta en ny enhet.",
    "ev.operator_redeployed": "Operatør {id} tilbake i tjeneste — ta en ny enhet.",
    "ev.operator_returned": "Operatør {id} kom seg hjem til fots.",
    "ev.tow_started": "Enhet {by} tauer vrak {id}.",
    "ev.recovery_started": "Vrak {id} i verkstedet.",
    "ev.asset_restored": "Enhet {id} tilbake i tjeneste!",
    "ev.asset_manufactured": "Hjemmebasen bygde om enhet {id} — forsterkninger!",
    "end.victory": "SEIER",
    "end.defeat": "NEDERLAG",
    "end.draw": "UAVGJORT",
    "end.next_war": "Neste krig begynner om ~{s}s — bli i setet.",
    "end.honors": "UTMERKELSER",
    "win.elimination": "fiendens styrke ble utslettet",
    "win.domination": "alle reléer holdt lenge nok — totalt herredømme",
    "win.points": "krigsklokka løp ut — poengene avgjorde",
    "win.standard": "kommandostandarten ble erobret",
    "win.unknown": "ukjent",
    "brief.fight_for": "Du kjemper for {name}.",
    "brief.win": "SEIER: en KOMMANDOVOGN må ta fiendens standart (høy fane) hjem mens din egen standart er trygg. Lastebiler tauer vrak; alle eskorterer.",
    "brief.relays": "RELÉER (master langs veien) gir forsyning — uten forsyning kryper du og kan ikke skyte.",
    "brief.fog": "Fiender skjules av tåke til enhetene dine kommer nær. Vrak kan taues hjem og repareres.",
    "brief.clicks": "Klikk: din enhet = ta den · bakken = kjør · fiende = skyt · eget vrak = tau.",
"""

patch("client/js/strings.js",
"""    // ── ping options ──""",
EN + """    // ── ping options ──""")
patch("client/js/strings.js",
"""    "ping.attack": "ANGRIP HER",""",
NO + """    "ping.attack": "ANGRIP HER",""")

# feedback_model: describeEvent through t(); win reasons through t().
src = open("client/js/feedback_model.js").read()
import re
start = src.index("export function describeEvent(e, myTeam) {")
end = src.index("\n}", start) + 2
new_fn = '''export function describeEvent(e, myTeam) {
  switch (e?.type) {
    case "rejected": return describeRejection(e.reason);
    case "operator_unboarded": return t("ev.operator_unboarded", { id: e.operatorId });
    case "option_set": return null;
    case "hardpoint_deploying": return t("ev.hardpoint_deploying");
    case "hardpoint_active": return t("ev.hardpoint_active");
    case "hardpoint_undeploying": return t("ev.hardpoint_undeploying");
    case "hardpoint_stowed": return t("ev.hardpoint_stowed");
    case "site_shelled": return t("ev.site_shelled", { id: e.siteId });
    case "site_damaged": return t("ev.site_damaged", { id: e.siteId });
    case "site_repaired": return t("ev.site_repaired", { id: e.siteId });
    case "site_neutralized":
      return t(e.byTeam === myTeam ? "ev.site_neutralized_us" : "ev.site_neutralized_them", { id: e.siteId });
    case "site_captured":
      return t(e.team === myTeam ? "ev.site_captured_us" : "ev.site_captured_them", { id: e.siteId });
    case "asset_disabled": return t("ev.asset_disabled", { id: e.assetId });
    case "mine_deployed":
      return e.team === myTeam ? t("ev.mine_deployed", { n: e.minesLeft }) : null;
    case "mine_marked": return t("ev.mine_marked");
    case "mine_detonated": return t("ev.mine_detonated", { id: e.assetId });
    case "mine_cleared": return t("ev.mine_cleared", { id: e.assetId });
    case "ping": {
      const label = (e.kind ?? "").replace(/_/g, " ").toUpperCase();
      return t("ev.ping", { label, x: e.cellX, y: e.cellY });
    }
    case "drone_launched": return t("ev.drone_launched");
    case "drone_hit": return t("ev.drone_hit", { id: e.assetId });
    case "drone_downed": return t("ev.drone_downed", { id: e.byAssetId });
    case "drone_recalled": return t("ev.drone_recalled");
    case "resupplied": return t("ev.resupplied", { id: e.assetId });
    case "standard_taken":
      return t(e.byTeam === myTeam ? "ev.standard_taken_us" : "ev.standard_taken_them");
    case "standard_dropped": return t("ev.standard_dropped");
    case "standard_returned":
      return t(e.team === myTeam ? "ev.standard_returned_us" : "ev.standard_returned_them");
    case "standard_scored":
      return t(e.byTeam === myTeam ? "ev.standard_scored_us" : "ev.standard_scored_them");
    case "operator_downed": return t("ev.operator_downed", { id: e.operatorId });
    case "operator_rescued": return t("ev.operator_rescued", { by: e.byAssetId, id: e.operatorId });
    case "operator_delivered": return t("ev.operator_delivered", { id: e.operatorId });
    case "operator_redeployed": return t("ev.operator_redeployed", { id: e.operatorId });
    case "operator_returned": return t("ev.operator_returned", { id: e.operatorId });
    case "crawl_ordered": return null;
    case "tow_started": return t("ev.tow_started", { by: e.by, id: e.assetId });
    case "recovery_started": return t("ev.recovery_started", { id: e.assetId });
    case "asset_restored": return t("ev.asset_restored", { id: e.assetId });
    case "asset_manufactured": return t("ev.asset_manufactured", { id: e.assetId });
    case "game_over": return null; // handled by the end screen
    default: return null;
  }
}
'''
src = src[:start] + new_fn + src[end:]
open("client/js/feedback_model.js", "w").write(src)

patch("client/js/feedback_model.js",
"""export function describeWinReason(reason) {
  return WIN_REASON_TEXT[reason] ?? "unknown";
}""",
"""export function describeWinReason(reason) {
  const keys = { 1: "win.elimination", 2: "win.domination", 3: "win.points", 4: "win.standard" };
  return t(keys[reason] ?? "win.unknown");
}""")
patch("client/js/feedback_model.js",
"""  const title = view.winner === -1 ? "DRAW"
    : view.winner === myTeam ? "VICTORY" : "DEFEAT";""",
"""  const title = view.winner === -1 ? t("end.draw")
    : view.winner === myTeam ? t("end.victory") : t("end.defeat");""")
patch("client/js/feedback_model.js",
"""    nextWarText: `Next war begins in ~${postgameSeconds}s — stay in your seat.`,""",
"""    nextWarText: t("end.next_war", { s: postgameSeconds }),""")

# briefing through t() (objective_model is pure — it may import strings).
patch("client/js/objective_model.js",
"""export function briefingText(myTeam, faction = null) {
  const teamName = faction
    ? `${faction.name.toUpperCase()} — ${faction.tacticalIdentity}`
    : myTeam === 0 ? "GREEN (west)" : "RED (east)";
  return [
    `You fight for ${teamName}.`,
    ...(faction ? [faction.line] : []),
    "WIN: a COMMAND CARRIER must take the enemy standard (tall banner) home while your own standard is safe. Trucks tow wrecks; everyone escorts.",
    "RELAYS (masts on the road) project supply — out of supply you crawl and cannot fire.",
    "Enemies are hidden by fog until your units get close. Wrecks can be towed home and repaired.",
    "Click: your unit = take it · ground = move · enemy = fire · friendly wreck = tow.",
  ].join("\\n");
}""",
"""export function briefingText(myTeam, faction = null) {
  const teamName = faction
    ? `${faction.name.toUpperCase()} — ${faction.tacticalIdentity}`
    : myTeam === 0 ? "GREEN (west)" : "RED (east)";
  return [
    t("brief.fight_for", { name: teamName }),
    ...(faction ? [faction.line] : []),
    t("brief.win"),
    t("brief.relays"),
    t("brief.fog"),
    t("brief.clicks"),
  ].join("\\n");
}""")
src = open("client/js/objective_model.js").read()
if 'from "./strings.js"' not in src:
    open("client/js/objective_model.js", "w").write('import { t } from "./strings.js";\n' + src)

# end screen HONORS heading through t().
patch("client/js/client.js",
"""  document.getElementById("end-reason").innerText = summary.reason +
    (honors.length ? "\\n\\nHONORS\\n" + honors.join("\\n") : "");""",
"""  document.getElementById("end-reason").innerText = summary.reason +
    (honors.length ? `\\n\\n${t("end.honors")}\\n` + honors.join("\\n") : "");""")
print("15B part 2 patched")
