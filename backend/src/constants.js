/**
 * Passwörter und feste Werte (in Produktion aus Umgebungsvariablen lesen).
 */
export const PLAYER_PASSWORD =
  (typeof process !== "undefined" && process.env.PLAYER_PASSWORD) || "JUGENDINNSBRUCK";
export const ADMIN_PASSWORD =
  (typeof process !== "undefined" && process.env.ADMIN_PASSWORD) || "JUGENDADMIN";

export const DEFAULT_ROOM_CODE = "WOLF";

export const DEFAULT_RULES = {
  minPlayers: 3,
  maxPlayers: Infinity,
  voteDurationSeconds: 180,
  mayorElectionEnabled: true,
  revealRolesToDead: true,
  seherMode: "good_evil", // "good_evil" or "exact_role"
  roles: {
    werwolf: { count: "1/3", enabled: true },
    seher: { count: 1, enabled: true },
    hexe: { count: 1, enabled: true },
    dorfbewohner: { count: 0, enabled: false },
    amor: { count: 1, enabled: false },
    kopfgeldjaeger: { count: 1, enabled: false },
    jaeger: { count: 1, enabled: false },
    blinzelmaedchen: { count: 1, enabled: false },
    baecker: { count: 1, enabled: false },
  },
};
