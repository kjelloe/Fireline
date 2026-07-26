def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))
import re

# ── feedback_model: rejections flow through t(); catalog is the source ──────
src = open("client/js/feedback_model.js").read()
start = src.index("export const REJECTION_TEXT = Object.freeze({")
end = src.index("});", start) + 3
src = (src[:start] +
"""// 15B: rejection texts live in strings.js catalogs (en/no). This proxy
// keeps the historic REJECTION_TEXT contract (8H sweeps it) while t()
// serves the active locale.
export const REJECTION_TEXT = new Proxy({}, {
  get: (_, reason) =>
    typeof reason === "string" && hasKey(`rej.${reason}`) ? t(`rej.${reason}`) : undefined,
  has: (_, reason) => typeof reason === "string" && hasKey(`rej.${reason}`),
});""" + src[end:])
src = src.replace(
"""export function describeRejection(reason) {""",
"""export function describeRejection(reason) {
  if (hasKey(`rej.${reason}`)) return t(`rej.${reason}`);
  return t("rej.fallback", { reason });
}

function legacyDescribeRejection(reason) {""", 1)
src = 'import { t, hasKey } from "./strings.js";\n' + src
open("client/js/feedback_model.js", "w").write(src)

# ── ping_model labels via t() ────────────────────────────────────────────────
p = "client/js/ping_model.js"
patch(p, """const DEFAULTS = [
  { kind: "attack", label: "ATTACK HERE" },
  { kind: "defend", label: "DEFEND HERE" },
  { kind: "rally", label: "RALLY ON ME" },
];""",
"""import { t } from "./strings.js";

const DEFAULTS = () => [
  { kind: "attack", label: t("ping.attack") },
  { kind: "defend", label: t("ping.defend") },
  { kind: "rally", label: t("ping.rally") },
];""")
src = open(p).read()
src = src.replace('return [{ kind: "need_rescue", label: "NEED RESCUE" }];',
                  'return [{ kind: "need_rescue", label: t("ping.need_rescue") }];')
src = src.replace('if (!me) return DEFAULTS;', 'if (!me) return DEFAULTS();')
src = src.replace('{ kind: "need_escort", label: "ESCORT THE STANDARD" }',
                  '{ kind: "need_escort", label: t("ping.escort_standard") }')
src = src.replace('{ kind: "carrier_under_attack", label: "CARRIER UNDER ATTACK" }',
                  '{ kind: "carrier_under_attack", label: t("ping.carrier_under_attack") }')
src = src.replace('{ kind: "recovery_in_progress", label: "RECOVERY IN PROGRESS" }',
                  '{ kind: "recovery_in_progress", label: t("ping.recovery_in_progress") }')
src = src.replace('{ kind: "need_escort", label: "NEED ESCORT" }',
                  '{ kind: "need_escort", label: t("ping.need_escort") }')
src = src.replace('{ kind: "road_blocked", label: "ROAD BLOCKED" }',
                  '{ kind: "road_blocked", label: t("ping.road_blocked") }')
src = src.replace('{ kind: "mines_detected", label: "MINES DETECTED" }',
                  '{ kind: "mines_detected", label: t("ping.mines_detected") }')
src = src.replace('{ kind: "safe_route", label: "SAFE ROUTE MARKED" }',
                  '{ kind: "safe_route", label: t("ping.safe_route") }')
src = src.replace("""  for (const d of DEFAULTS) {""", """  for (const d of DEFAULTS()) {""")
open(p, "w").write(src)

# ── tasks_model labels via t() ───────────────────────────────────────────────
p = "client/js/tasks_model.js"
src = open(p).read()
src = 'import { t } from "./strings.js";\n' + src
src = src.replace('label: "STOP THE THIEF — our standard is moving"', 'label: t("task.stop_thief")')
src = src.replace('label: "Secure our standard — it lies in the open"', 'label: t("task.secure_standard")')
src = src.replace('label: "Escort the standard run home"', 'label: t("task.escort_carrier")')
src = src.replace('label: `Rescue operator ${d.operatorId} — a carrier can pick them up`',
                  'label: t("task.rescue", { id: d.operatorId })')
src = src.replace('label: `Defend relay ${s.id} — the flag is dropping`',
                  'label: t("task.defend_relay", { id: s.id })')
src = src.replace('label: `Rebuild relay ${s.id} — a truck with materiel can fix it`',
                  'label: t("task.repair_site", { id: s.id })')
src = src.replace('label: `Towing asset ${a.id} — head home`', 'label: t("task.towing_now", { id: a.id })')
src = src.replace('label: `Recover asset ${a.id} — tow it home`', 'label: t("task.recover", { id: a.id })')
open(p, "w").write(src)

# ── client.js: banners/labels/ui strings + locale plumbing ───────────────────
p = "client/js/client.js"
patch(p, """import { updateGhosts, ghostOpacity } from "./ghosts_model.js";""",
"""import { updateGhosts, ghostOpacity } from "./ghosts_model.js";
import { t, setLocale, getLocale } from "./strings.js";""")
patch(p, """      text = `YOU ARE DOWN — redeploy in ${wait}s`;""",
"""      text = t("banner.down_wait", { s: wait });""")
patch(p, """      text = "REDEPLOY NOW (R) — or crawl to a carrier";""",
"""      text = t("banner.down_ready");""")
patch(p, """      text = `TOW ASSET ${wreck.id} (T)`;""",
"""      text = t("banner.tow", { id: wreck.id });""")
patch(p, """      mine
        ? (canBoard ? "CARRIER HERE — B TO BOARD" : "YOU ARE DOWN — R TO REDEPLOY")
        : "OPERATOR DOWN",""",
"""      mine
        ? (canBoard ? t("label.board_here") : t("label.you_down"))
        : t("label.operator_down"),""")
patch(p, """      upsertWorldLabel(key, `REPAIRING ${Math.ceil(a.recoverTimer / 10)}s`, "#8fd4ff",""",
"""      upsertWorldLabel(key, t("label.repairing", { s: Math.ceil(a.recoverTimer / 10) }), "#8fd4ff",""")
patch(p, """    const who = site.owner === -1 ? "NEUTRAL" : site.owner === joined?.team ? "YOURS" : "ENEMY";""",
"""    const who = site.owner === -1 ? t("label.who_neutral")
      : site.owner === joined?.team ? t("label.who_yours") : t("label.who_enemy");""")
patch(p, """      detail = "DAMAGED — truck + materiel rebuilds";""",
"""      detail = t("label.relay_damaged");""")
patch(p, """      const phase = site.owner === -1 ? "RAISING" : "DROPPING";
      const secs = Math.ceil((30 - site.captureProgress) / 10);
      const hostile = site.capturingTeam !== joined?.team;
      detail = `${phase} ${secs}s${hostile ? " — DEFEND!" : ""}`;""",
"""      const secs = Math.ceil((30 - site.captureProgress) / 10);
      const hostile = site.capturingTeam !== joined?.team;
      detail = hostile && site.owner !== -1
        ? t("label.relay_dropping", { s: secs })
        : t("label.relay_raising", { s: secs });""")
patch(p, """    upsertWorldLabel(`site${site.id}`,
      detail ? `RELAY — ${who}\\n${detail}` : `RELAY — ${who}`, color,""",
"""    upsertWorldLabel(`site${site.id}`,
      detail ? `${t("label.relay", { who })}\\n${detail}` : t("label.relay", { who }), color,""")
patch(p, """    let text = mine ? "YOUR STANDARD" : "ENEMY STANDARD — STEAL IT";""",
"""    let text = mine ? t("label.std_yours") : t("label.std_enemy");""")
patch(p, """      text = (mine ? "YOUR STANDARD IS DOWN" : "ENEMY STANDARD IN THE OPEN") +
        `\\nauto-returns in ${secs}s`;""",
"""      text = (mine ? t("label.std_yours_down") : t("label.std_enemy_open")) +
        "\\n" + t("label.std_returns", { s: secs });""")
patch(p, """      pushEvent(directMode
        ? "DIRECT DRIVE — W/S throttle, A/D steer, G to exit"
        : "Direct drive off — click-to-move restored.");""",
"""      pushEvent(directMode ? t("ui.direct_on") : t("ui.direct_off"));""")
patch(p, """      pushEvent("Spectating — you see everything, you touch nothing.");""",
"""      pushEvent(t("ui.spectating"));""")
patch(p, """      pushEvent("A new war has begun!");""",
"""      pushEvent(t("ui.new_war"));""")
patch(p, """          pushEvent(`You are crewing asset ${target} — click ground to move`);""",
"""          pushEvent(t("ui.crewing", { id: target }));""")

# Locale plumbing: restore from localStorage at boot; ⚙ dropdown.
patch(p, """  // 11G: settings panel.""",
"""  // 15B: locale — restore, and offer the switch in ⚙.
  setLocale(localStorage.getItem("mf_locale") ?? "en");
  const localeSel = document.getElementById("opt-locale");
  if (localeSel) {
    localeSel.value = getLocale();
    localeSel.onchange = (e) => {
      setLocale(e.target.value);
      localStorage.setItem("mf_locale", e.target.value);
      lastTaskKey = ""; // force HUD rebuilds in the new language
      for (const [, entry] of worldLabels) scene.remove(entry.sprite);
      worldLabels.clear();
    };
  }
  // 11G: settings panel.""")
patch("client/index.html",
"""        <button class="btn" id="btn-settings-close">Close (Esc)</button>""",
"""        <label style="color:#cdc; font-family:sans-serif; font-size:14px;">
            Language / Språk:
            <select id="opt-locale">
                <option value="en">English</option>
                <option value="no">Norsk</option>
            </select>
        </label>
        <button class="btn" id="btn-settings-close">Close (Esc)</button>""")
print("15B wired")
