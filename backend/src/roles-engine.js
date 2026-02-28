/**
 * Rollen-Engine: Automatische Verteilung der Rollen laut rules.
 * Nur Rollen von https://werwolf.fandom.com/de/wiki/Rollen;
 * Standard: 1/3 Werwölfe, 1 Seher, 1 Hexe; Dorfbewohner nur wenn aktiviert.
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
];

/**
 * Ermittelt die Anzahl einer Rolle für n Spieler.
 * @param {object} roleConfig - { count: number | "1/3", enabled: boolean }
 * @param {number} playerCount
 * @returns {number}
 */
function resolveCount(roleConfig, playerCount) {
  if (!roleConfig || !roleConfig.enabled) return 0;
  const c = roleConfig.count;
  if (c === "1/3") return Math.max(1, Math.floor(playerCount / 3));
  const n = Number(c);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Verteilt Rollen an playerCount Spieler gemäß rules.roles.
 * Feste Rollen (werwolf, seher, hexe, …) werden zuerst belegt;
 * wenn dorfbewohner.enabled, füllen Dorfbewohner den Rest.
 * @param {object} rules - state.rules (mit rules.roles)
 * @param {number} playerCount
 * @returns {string[]} Array von Rollen-IDs, Länge playerCount
 */
export function distributeRoles(rules, playerCount) {
  const rolesConfig = rules?.roles || {};
  const bag = [];

  for (const roleId of ROLE_IDS) {
    const config = rolesConfig[roleId];
    const count = resolveCount(config, playerCount);
    for (let i = 0; i < count; i++) bag.push(roleId);
  }

  const filled = bag.length;
  if (filled > playerCount) {
    const excess = filled - playerCount;
    let removed = 0;
    for (let i = bag.length - 1; i >= 0 && removed < excess; i--) {
      if (bag[i] === "dorfbewohner" || bag[i] === "werwolf") {
        bag.splice(i, 1);
        removed++;
      }
    }
  }

  if (filled < playerCount && rolesConfig.dorfbewohner?.enabled) {
    const need = playerCount - bag.length;
    for (let i = 0; i < need; i++) bag.push("dorfbewohner");
  } else if (bag.length < playerCount) {
    const need = playerCount - bag.length;
    for (let i = 0; i < need; i++) bag.push("dorfbewohner");
  }

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
 * Gibt für die UI die konfigurierbaren Rollen mit Anzeigenamen zurück.
 */
export function getRoleMeta() {
  return {
    werwolf: { label: "Werwolf", team: "werwolf" },
    seher: { label: "Seher", team: "village" },
    hexe: { label: "Hexe", team: "village" },
    dorfbewohner: { label: "Dorfbewohner", team: "village" },
    amor: { label: "Amor", team: "village" },
    kopfgeldjaeger: { label: "Kopfgeldjäger", team: "village" },
    jaeger: { label: "Jäger", team: "village" },
    blinzelmaedchen: { label: "Blinzelmädchen", team: "village" },
  };
}
