/**
 * Rollen-Engine: Automatische Verteilung der Rollen laut rules.
 * Rollen orientiert an https://werwolf.fandom.com/de/wiki/Rollen.
 * Standard: 1/3 Werwölfe, 1 Seher, 1 Hexe; Dorfbewohner füllen den Rest.
 */

/** Reihenfolge für count "1/3" oder feste Zahlen. Dorfbewohner füllen den Rest. */
const ROLE_IDS = [
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
];

/** Welche Rollen beim Überlauf zuerst entfernt werden (Füll-/Bulk-Rollen). */
const TRIMMABLE = ["dorfbewohner", "werwolf"];

/**
 * Ermittelt die Anzahl einer Rolle für n Spieler.
 * @param {object} roleConfig - { count: number | "1/3", enabled: boolean }
 * @param {number} playerCount
 * @returns {number}
 */
export function resolveCount(roleConfig, playerCount) {
  if (!roleConfig || !roleConfig.enabled) return 0;
  const c = roleConfig.count;
  if (c === "1/3") return Math.max(1, Math.floor(playerCount / 3));
  const n = Number(c);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/**
 * Summe aller konfigurierten Rollen für eine bestimmte Spielerzahl.
 * (Dorfbewohner werden NICHT automatisch dazugezählt – nur explizit konfigurierte.)
 */
export function totalConfiguredRoles(rules, playerCount) {
  const rolesConfig = rules?.roles || {};
  return ROLE_IDS.reduce((sum, roleId) => sum + resolveCount(rolesConfig[roleId], playerCount), 0);
}

/**
 * Verteilt Rollen an playerCount Spieler gemäß rules.roles.
 * Feste Rollen (werwolf, seher, hexe, …) werden zuerst belegt;
 * der Rest wird mit Dorfbewohnern aufgefüllt.
 * @param {object} rules - state.rules (mit rules.roles)
 * @param {number} playerCount
 * @returns {string[]} Array von Rollen-IDs, Länge playerCount
 */
export function distributeRoles(rules, playerCount) {
  const rolesConfig = rules?.roles || {};
  const bag = [];

  for (const roleId of ROLE_IDS) {
    const count = resolveCount(rolesConfig[roleId], playerCount);
    for (let i = 0; i < count; i++) bag.push(roleId);
  }

  // Überlauf: zuerst Bulk-Rollen (Dorfbewohner, dann Werwölfe) abbauen,
  // damit einzigartige Spezialrollen nicht zufällig verloren gehen.
  if (bag.length > playerCount) {
    let excess = bag.length - playerCount;
    for (const trimRole of TRIMMABLE) {
      for (let i = bag.length - 1; i >= 0 && excess > 0; i--) {
        if (bag[i] === trimRole) {
          bag.splice(i, 1);
          excess--;
        }
      }
    }
    // Falls immer noch zu viele (sehr ungewöhnlich): vom Ende kürzen.
    if (bag.length > playerCount) bag.length = playerCount;
  }

  // Unterbelegung: mit Dorfbewohnern auffüllen.
  while (bag.length < playerCount) bag.push("dorfbewohner");

  shuffle(bag);
  return bag.slice(0, playerCount);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Gibt für die UI die konfigurierbaren Rollen mit Anzeigenamen und Team zurück.
 * team: "werwolf" | "village" | "solo"
 */
export function getRoleMeta() {
  return {
    werwolf: { label: "Werwolf", team: "werwolf" },
    seher: { label: "Seher", team: "village" },
    hexe: { label: "Hexe", team: "village" },
    dorfbewohner: { label: "Dorfbewohner", team: "village" },
    amor: { label: "Amor", team: "village" },
    kopfgeldjaeger: { label: "Kopfgeldjäger", team: "solo" },
    jaeger: { label: "Jäger", team: "village" },
    blinzelmaedchen: { label: "Blinzelmädchen", team: "village" },
    baecker: { label: "Bäcker", team: "village" },
    beschuetzer: { label: "Beschützer", team: "village" },
  };
}
