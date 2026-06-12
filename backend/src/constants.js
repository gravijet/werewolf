/**
 * Passwörter und feste Werte.
 * In Produktion IMMER über Umgebungsvariablen setzen (PLAYER_PASSWORD / ADMIN_PASSWORD).
 * Die Defaults hier dienen nur der lokalen Entwicklung.
 */
export const PLAYER_PASSWORD =
  (typeof process !== "undefined" && process.env.PLAYER_PASSWORD) || "WOLFGAME";
export const ADMIN_PASSWORD =
  (typeof process !== "undefined" && process.env.ADMIN_PASSWORD) || "WOLFGAMEADMIN";

export const DEFAULT_ROOM_CODE = "WOLF";

/**
 * Obergrenze für Spieler in einem Raum. Endlicher Wert, damit der State
 * JSON-serialisierbar bleibt (Infinity würde bei JSON.stringify zu null werden
 * und die Beitritts-Prüfung kaputt machen).
 */
export const MAX_PLAYERS = 50;

export const DEFAULT_RULES = {
  minPlayers: 3,
  maxPlayers: MAX_PLAYERS,
  voteDurationSeconds: 180,
  mayorElectionEnabled: true,
  revealRolesToDead: true,
  seherMode: "good_evil", // "good_evil" oder "exact_role"
  roles: {
    werwolf: { count: "1/3", enabled: true },
    seher: { count: 1, enabled: true },
    hexe: { count: 1, enabled: true },
    dorfbewohner: { count: 0, enabled: false },
    amor: { count: 0, enabled: false },
    kopfgeldjaeger: { count: 0, enabled: false },
    jaeger: { count: 0, enabled: false },
    blinzelmaedchen: { count: 0, enabled: false },
    baecker: { count: 0, enabled: false },
    beschuetzer: { count: 0, enabled: false },
    aelteste: { count: 0, enabled: false },
    zwilling: { count: 0, enabled: false },
    dorfdepp: { count: 0, enabled: false },
    suendenbock: { count: 0, enabled: false },
    wildeskind: { count: 0, enabled: false },
  },
};

/** Obergrenze für das Spielprotokoll, damit der State nicht unbegrenzt wächst. */
export const MAX_GAME_LOG_ENTRIES = 200;
