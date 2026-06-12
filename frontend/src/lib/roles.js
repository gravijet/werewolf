/**
 * Zentrale Rollen-Liste des Frontends – muss mit ROLE_IDS im Backend
 * (backend/src/roles-engine.js) übereinstimmen. Wird von Lobby- und
 * Admin-Screen gemeinsam genutzt, damit neue Rollen nur an einer Stelle
 * ergänzt werden müssen.
 */
export const ROLE_IDS = [
  "werwolf",
  "seher",
  "hexe",
  "dorfbewohner",
  "amor",
  "kopfgeldjaeger",
  "jaeger",
  "blinzelmaedchen",
  "baecker",
  "beschuetzer",
  "aelteste",
  "zwilling",
  "dorfdepp",
  "suendenbock",
  "wildeskind",
];

/**
 * Summe der konfigurierten Rollen für eine Spielerzahl – Spiegel der
 * Backend-Logik (resolveCount), damit Lobby/Admin die Plausibilität
 * der Regeln anzeigen können.
 */
export function countConfiguredRoles(rules, playerCount) {
  return ROLE_IDS.reduce((sum, roleId) => {
    const r = rules?.roles?.[roleId];
    if (!r?.enabled) return sum;
    if (roleId === "werwolf" && r.count === "1/3") return sum + Math.max(1, Math.floor(playerCount / 3));
    return sum + (Number(r.count) || 0);
  }, 0);
}
