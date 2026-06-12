/**
 * In-Memory-Game-State für einen einzigen aktiven Spielraum.
 * Alle Änderungen gehen über diese Modul-API.
 */

import { randomUUID } from "crypto";
import { DEFAULT_ROOM_CODE, DEFAULT_RULES, MAX_PLAYERS, MAX_GAME_LOG_ENTRIES } from "./constants.js";
import { distributeRoles } from "./roles-engine.js";
import * as persistence from "./persistence.js";

let state = {
  phase: "lobby",
  roomCode: DEFAULT_ROOM_CODE,
  players: [],
  rules: structuredClone(DEFAULT_RULES),
  mayorElection: null,
  night: null,
  day: null,
  gameLog: [],
  winner: null,
  round: 0,
};

/** Bans: map von playerId -> { name, timestamp, fingerprint, ip } und Sets für schnelle Prüfung. */
const bans = {
  players: new Map(),
  fingerprints: new Set(),
  ips: new Set(),
};

/**
 * Einladungs-Token: Der passwortlose Beitritts-Link enthält dieses Token statt
 * des Spieler-Passworts. So funktioniert der Link auch, wenn PLAYER_PASSWORD
 * geändert wird, ohne das Passwort im Frontend zu verraten.
 */
let inviteToken = randomUUID();

export function getInviteToken() {
  return inviteToken;
}

export function rotateInviteToken() {
  inviteToken = randomUUID();
  return inviteToken;
}

/** Beim Serverstart: gespeichertes Token übernehmen, damit geteilte Links/QR-Codes gültig bleiben. */
export function restoreInviteToken(token) {
  if (typeof token === "string" && token.length >= 16) inviteToken = token;
}

/**
 * Für Persistenz: Roh-State und Bans serialisierbar machen.
 */
export function getStateForPersistence() {
  return JSON.parse(JSON.stringify(state));
}

export function getBansForPersistence() {
  return {
    players: Array.from(bans.players.entries()),
    fingerprints: Array.from(bans.fingerprints),
    ips: Array.from(bans.ips),
  };
}

/** Vollständiger Persistenz-Snapshot (State, Bans, Einladungs-Token). */
export function getPersistSnapshot() {
  return {
    state: getStateForPersistence(),
    bans: getBansForPersistence(),
    inviteToken,
  };
}

/**
 * State und Bans aus geladener Persistenz wiederherstellen.
 */
export function loadStateFromPersistence(data) {
  if (!data?.state) return;
  state = data.state;
  loadBansFromPersistence(data);
}

/**
 * Nur die Bans wiederherstellen (ohne Spielzustand). Wird beim Serverstart
 * genutzt: Die Lobby beginnt leer, aber Sperren überleben einen Neustart.
 */
export function loadBansFromPersistence(data) {
  if (!data?.bans) return;
  bans.players = new Map(Array.isArray(data.bans.players) ? data.bans.players : []);
  bans.fingerprints = new Set(data.bans.fingerprints || []);
  bans.ips = new Set(data.bans.ips || []);
}

function schedulePersist() {
  try {
    persistence.save(getPersistSnapshot());
  } catch (e) {
    console.warn("Persist:", e.message);
  }
}

/**
 * Prüft, ob ein Spieler gebannt ist (playerId, optional fingerprint/IP).
 */
export function isBanned({ playerId, fingerprint, ip }) {
  if (playerId && bans.players.has(playerId)) return true;
  if (fingerprint && bans.fingerprints.has(fingerprint)) return true;
  if (ip && bans.ips.has(ip)) return true;
  return false;
}

/**
 * Bannt einen Spieler (playerId + optional fingerprint/IP).
 */
export function addBan({ playerId, name, fingerprint, ip }) {
  if (playerId) bans.players.set(playerId, { name: name || "Unbekannt", timestamp: new Date().toISOString(), fingerprint, ip });
  if (fingerprint) bans.fingerprints.add(fingerprint);
  if (ip) bans.ips.add(ip);
}

/**
 * Entfernt Ban.
 */
export function removeBan(adminPlayerId, targetPlayerId) {
  const admin = findPlayer(adminPlayerId);
  if (!admin || !admin.isAdmin) return { ok: false, error: "not_admin" };
  
  const banData = bans.players.get(targetPlayerId);
  if (banData) {
    if (banData.fingerprint) bans.fingerprints.delete(banData.fingerprint);
    if (banData.ip) bans.ips.delete(banData.ip);
    bans.players.delete(targetPlayerId);
  }
  schedulePersist();
  return { ok: true };
}

/**
 * Minimaler öffentlicher Zustand für Sockets, die (noch) keinem Spieler
 * zugeordnet sind. Verhindert, dass Unbeteiligte Spielernamen, Stimmen oder
 * Spielverlauf mitlesen können – die Join-Maske braucht nur Phase und Anzahl.
 */
export function getPublicState() {
  return {
    public: true,
    phase: state.phase,
    round: state.round,
    playersCount: state.players.filter((p) => !p.isHost).length,
    rules: { minPlayers: state.rules.minPlayers, maxPlayers: state.rules.maxPlayers },
  };
}

/**
 * Gibt den kompletten State zurück (für Broadcast/Reconnect).
 * Optionale Maske: welcher Spieler fragt (für rollenbasierte Sicht).
 */
export function getState(viewerPlayerId = null) {
  const players = state.players.map((p) => maskPlayer(p, viewerPlayerId));
  const viewer = state.players.find((p) => p.playerId === viewerPlayerId);
  
  const outState = {
    ...state,
    players,
  };

  // Mask night actions to avoid cheating
  if (outState.night) {
    outState.night = { ...outState.night };
    if (!viewer?.isHost && !viewer?.isAdmin) {
      const rawActions = state.night?.actions || {};
      const isBlinzelPeeking = viewer?.role === "blinzelmaedchen" && outState.night?.subPhase === "werwolf";
      outState.night.actions = {
        werwolf: {
          targetId:
            viewer?.role === "werwolf" || viewer?.role === "hexe"
              ? rawActions.werwolf?.targetId
              : null,
          werwolfIds: isBlinzelPeeking
            ? state.players.filter((p) => p.role === "werwolf" && p.isAlive).map((p) => p.playerId)
            : null,
        },
        seher: { 
          targetId: viewer?.role === 'seher' ? rawActions.seher?.targetId : null,
          isTargetEvil: viewer?.role === 'seher' ? rawActions.seher?.isTargetEvil : null,
          exactRole: viewer?.role === 'seher' ? rawActions.seher?.exactRole : null
        },
        hexe: { 
          healId: viewer?.role === 'hexe' ? rawActions.hexe?.healId : null,
          poisonId: viewer?.role === 'hexe' ? rawActions.hexe?.poisonId : null,
          passed: viewer?.role === 'hexe' ? rawActions.hexe?.passed : null
        },
        baecker: {
          targetId: viewer?.role === 'baecker' ? rawActions.baecker?.targetId : null
        },
        beschuetzer: {
          targetId: viewer?.role === 'beschuetzer' ? rawActions.beschuetzer?.targetId : null
        },
        amor: {
          lover1Id: viewer?.role === 'amor' ? rawActions.amor?.lover1Id : null,
          lover2Id: viewer?.role === 'amor' ? rawActions.amor?.lover2Id : null
        }
      };
    }
  }

  // Wen der Beschützer zuletzt geschützt hat, darf nur er selbst (und die
  // Spielleitung) wissen – sonst könnten alle seine Wahl mitlesen.
  if (!viewer?.isHost && !viewer?.isAdmin && viewer?.role !== "beschuetzer") {
    outState.lastProtectedId = null;
  }

  // Einladungs-Token nur an Personen geben, die bereits im Raum sind.
  if (viewer) {
    outState.inviteToken = inviteToken;
  }

  if (viewer?.isAdmin) {
    outState.bannedPlayers = Array.from(bans.players.entries()).map(([id, data]) => ({
      playerId: id,
      name: data.name,
      timestamp: data.timestamp
    }));
  }

  return outState;
}

function maskPlayer(player, viewerPlayerId) {
  const isViewer = viewerPlayerId && player.playerId === viewerPlayerId;
  const viewer = state.players.find((p) => p.playerId === viewerPlayerId);
  const isDeadViewer = viewer && !viewer.isAlive;
  const isModerator = viewer && viewer.role === "moderator";
  const isGameEnd = state.phase === "game_end";
  // Zwillinge erkennen einander ab Spielbeginn.
  const isTwinPair =
    viewer && viewer.role === "zwilling" && player.role === "zwilling";
  // Am Spielende werden alle Rollen für alle sichtbar (Auflösung).
  const showRole =
    isViewer ||
    isGameEnd ||
    (isDeadViewer && state.rules?.revealRolesToDead) ||
    isModerator ||
    isTwinPair ||
    // Ein enttarnter Dorfdepp ist öffentlich bekannt.
    (player.role === "dorfdepp" && player.idiotRevealed);

  const out = {
    playerId: player.playerId,
    name: player.name,
    isAdmin: isViewer ? player.isAdmin : false,
    isHost: player.isHost,
    canChangeName: player.canChangeName,
    isConnected: player.isConnected,
    isAlive: player.isAlive,
    isMayor: player.isMayor,
    joinedAt: player.joinedAt,
    lastSeenAt: player.lastSeenAt,
  };
  if (showRole && state.phase !== "lobby") {
    out.role = player.role;
  }
  // Enttarnung des Dorfdepps ist öffentliches Wissen (er lebt, darf aber nicht mehr abstimmen).
  if (player.idiotRevealed) {
    out.idiotRevealed = true;
  }
  // Kopfgeldjäger: die ausgeloste Zielperson sieht nur der Kopfgeldjäger selbst
  // (am Spielende für die Auflösung auch alle anderen).
  if ((isViewer || isGameEnd) && player.role === "kopfgeldjaeger" && player.bountyTargetId) {
    out.bountyTargetId = player.bountyTargetId;
  }
  // Der Älteste sieht nur selbst, ob sein zusätzliches Leben verbraucht ist.
  if (isViewer && player.role === "aelteste") {
    out.elderUsedLife = Boolean(player.elderUsedLife);
  }
  // Verliebte: dem Spieler selbst immer, am Spielende allen (für die Auflösung).
  if ((isViewer || isGameEnd) && player.inLove) {
    out.inLove = true;
    if (isViewer) {
      const partner = state.players.find((p) => p.inLove && p.playerId !== player.playerId);
      out.lovePartnerId = partner?.playerId ?? null;
    }
  }
  return out;
}

/**
 * Lobby-Status: darf noch jemand beitreten?
 */
export function isJoinLocked() {
  return state.phase !== "lobby";
}

/**
 * Spieler nach playerId suchen.
 */
export function findPlayer(playerId) {
  return state.players.find((p) => p.playerId === playerId) ?? null;
}

/**
 * Spieler nach reconnectToken + playerId (für Reconnect).
 */
export function findPlayerByReconnect(playerId, reconnectToken) {
  const p = findPlayer(playerId);
  if (!p || p.reconnectToken !== reconnectToken) return null;
  return p;
}

/**
 * Socket-ID einem Spieler zuordnen (Map socket.id -> playerId).
 */
const socketToPlayerId = new Map();

export function setSocketPlayer(socketId, playerId) {
  socketToPlayerId.set(socketId, playerId);
}

export function getPlayerIdBySocket(socketId) {
  return socketToPlayerId.get(socketId) ?? null;
}

export function removeSocketPlayer(socketId) {
  socketToPlayerId.delete(socketId);
}

/**
 * Neuen Spieler hinzufügen (nur in Lobby, wenn nicht voll).
 */
export function addPlayer({
  playerId,
  name,
  isAdmin,
  isHost,
  reconnectToken,
  fingerprint,
  ip,
}) {
  if (state.phase !== "lobby") return { ok: false, error: "game_started" };
  if (state.players.length >= state.rules.maxPlayers)
    return { ok: false, error: "room_full" };
  const existing = state.players.find((p) => p.playerId === playerId);
  if (existing) {
    existing.name = name;
    existing.isConnected = true;
    existing.lastSeenAt = new Date().toISOString();
    return { ok: true, player: existing, rejoin: true };
  }

  const player = {
    playerId,
    name: String(name).trim().slice(0, 80) || "Unbekannt",
    isAdmin: !!isAdmin,
    isHost: !!isHost,
    canChangeName: true,
    isConnected: true,
    isAlive: true,
    role: null,
    isMayor: false,
    reconnectToken,
    fingerprint: fingerprint || null,
    ip: ip || null,
    joinedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  };
  state.players.push(player);
  schedulePersist();
  return { ok: true, player, rejoin: false };
}

/**
 * Ersten Spieler zum Host machen, wenn noch keiner gesetzt ist.
 */
export function ensureHost() {
  if (state.players.length === 0) return;
  const hasHost = state.players.some((p) => p.isHost);
  if (!hasHost) state.players[0].isHost = true;
}

/**
 * Verbindung: Spieler als verbunden markieren.
 */
export function setPlayerConnected(playerId, connected) {
  const p = findPlayer(playerId);
  if (p) {
    p.isConnected = connected;
    p.lastSeenAt = new Date().toISOString();
    schedulePersist();
  }
}

/**
 * Spieler verlässt (Disconnect): nur isConnected = false.
 */
export function setPlayerDisconnected(playerId) {
  setPlayerConnected(playerId, false);
}

/**
 * Namen ändern (Spieler selbst, wenn canChangeName).
 */
export function setPlayerName(playerId, newName) {
  const p = findPlayer(playerId);
  if (!p) return { ok: false, error: "player_not_found" };
  if (!p.canChangeName) return { ok: false, error: "name_locked" };
  const name = String(newName).trim().slice(0, 80) || p.name;
  // Keine Namens-Kollisionen: niemand darf sich auf den Namen einer anderen
  // Person umbenennen (Schutz vor Verwechslung/Impersonation).
  const clash = state.players.some(
    (other) => other.playerId !== playerId && other.name.toLowerCase() === name.toLowerCase()
  );
  if (clash) return { ok: false, error: "name_taken" };
  p.name = name;
  schedulePersist();
  return { ok: true, name };
}

/**
 * Admin: Namen eines anderen Spielers ändern.
 */
export function adminSetPlayerName(adminPlayerId, targetPlayerId, newName) {
  const admin = findPlayer(adminPlayerId);
  if (!admin || (!admin.isAdmin && !admin.isHost)) return { ok: false, error: "not_admin" };
  const target = findPlayer(targetPlayerId);
  if (!target) return { ok: false, error: "player_not_found" };
  const name = String(newName).trim().slice(0, 80) || target.name;
  // Auch Admin/Host dürfen niemanden auf einen bereits vergebenen Namen
  // umbenennen (Verwechslungs-/Impersonationsschutz wie bei setPlayerName).
  const clash = state.players.some(
    (other) => other.playerId !== targetPlayerId && other.name.toLowerCase() === name.toLowerCase()
  );
  if (clash) return { ok: false, error: "name_taken" };
  target.name = name;
  schedulePersist();
  return { ok: true, name: target.name };
}

/**
 * Admin: Namensänderung sperren/entsperren.
 */
export function adminLockName(adminPlayerId, targetPlayerId, lock) {
  const admin = findPlayer(adminPlayerId);
  if (!admin || (!admin.isAdmin && !admin.isHost)) return { ok: false, error: "not_admin" };
  const target = findPlayer(targetPlayerId);
  if (!target) return { ok: false, error: "player_not_found" };
  target.canChangeName = !lock;
  schedulePersist();
  return { ok: true, canChangeName: target.canChangeName };
}

/**
 * Admin: Spieler bannen. IP und Fingerprint werden aus dem gespeicherten Spieler-Objekt gelesen.
 */
export function adminBan(adminPlayerId, { targetPlayerId }) {
  const admin = findPlayer(adminPlayerId);
  if (!admin || !admin.isAdmin) return { ok: false, error: "not_admin" };
  const target = findPlayer(targetPlayerId);
  if (!target) return { ok: false, error: "player_not_found" };
  if (target.isAdmin) return { ok: false, error: "cannot_ban_admin" };
  addBan({ playerId: targetPlayerId, name: target.name, fingerprint: target.fingerprint, ip: target.ip });
  schedulePersist();
  return { ok: true };
}

/**
 * Admin: Host wechseln.
 */
export function adminSetHost(adminPlayerId, targetPlayerId) {
  const admin = findPlayer(adminPlayerId);
  if (!admin || (!admin.isAdmin && !admin.isHost)) return { ok: false, error: "not_admin" };
  const target = findPlayer(targetPlayerId);
  if (!target) return { ok: false, error: "player_not_found" };
  state.players.forEach((p) => (p.isHost = p.playerId === targetPlayerId));
  schedulePersist();
  return { ok: true };
}

/**
 * Admin oder Host: Regeln setzen (nur in Lobby).
 */
export function adminSetRules(adminPlayerId, newRules) {
  const admin = findPlayer(adminPlayerId);
  if (!admin || (!admin.isAdmin && !admin.isHost)) return { ok: false, error: "not_admin_or_host" };
  if (state.phase !== "lobby") return { ok: false, error: "game_started" };
  if (newRules && typeof newRules === "object") {
    const merged = { ...state.rules };

    // Nur bekannte Felder übernehmen und Werte hart begrenzen – ein Host darf
    // den Server nicht mit absurden Regeln (z. B. maxPlayers = 1e9) verstellen.
    const clampInt = (value, min, max, fallback) => {
      const n = Math.floor(Number(value));
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, n));
    };
    if ("minPlayers" in newRules) merged.minPlayers = clampInt(newRules.minPlayers, 3, MAX_PLAYERS, merged.minPlayers);
    if ("maxPlayers" in newRules) merged.maxPlayers = clampInt(newRules.maxPlayers, merged.minPlayers, MAX_PLAYERS, merged.maxPlayers);
    if ("voteDurationSeconds" in newRules)
      merged.voteDurationSeconds = clampInt(newRules.voteDurationSeconds, 30, 900, merged.voteDurationSeconds);
    if ("mayorElectionEnabled" in newRules) merged.mayorElectionEnabled = Boolean(newRules.mayorElectionEnabled);
    if ("revealRolesToDead" in newRules) merged.revealRolesToDead = Boolean(newRules.revealRolesToDead);
    if ("seherMode" in newRules && ["good_evil", "exact_role"].includes(newRules.seherMode)) {
      merged.seherMode = newRules.seherMode;
    }

    if (newRules.roles && typeof newRules.roles === "object") {
      const knownRoleIds = Object.keys(DEFAULT_RULES.roles);
      const normalizedRoles = {};
      for (const [roleId, roleConfig] of Object.entries(newRules.roles)) {
        if (!knownRoleIds.includes(roleId)) continue;
        const rawCount = roleConfig?.count;
        // "1/3" ist nur für Werwölfe sinnvoll (dynamische Anzahl).
        const normalizedCount =
          rawCount === "1/3" && roleId === "werwolf"
            ? "1/3"
            : clampInt(rawCount, 0, MAX_PLAYERS, 0);
        normalizedRoles[roleId] = {
          count: normalizedCount,
          enabled: normalizedCount === "1/3" ? true : normalizedCount > 0,
        };
      }
      merged.roles = { ...state.rules.roles, ...normalizedRoles };
    }
    state.rules = merged;
  }
  schedulePersist();
  return { ok: true, rules: state.rules };
}

/**
 * Spiel starten (nur Host oder Admin, nur in Lobby).
 * Rollenverteilung passiert in Schritt 3; hier nur Phase wechseln und Mayor-Election vorbereiten.
 */
export function startGame(hostPlayerId) {
  const host = findPlayer(hostPlayerId);
  if (!host || (!host.isHost && !host.isAdmin)) return { ok: false, error: "not_host" };
  if (state.phase !== "lobby") return { ok: false, error: "already_started" };
  
  const connectedPlayers = state.players.filter((p) => !p.isHost && p.isConnected);
  if (connectedPlayers.length < state.rules.minPlayers) return { ok: false, error: "not_enough_players" };

  // Rollen VOR jeder State-Mutation verteilen und prüfen: Ohne mindestens einen
  // Werwolf wäre die Partie sofort entschieden (Dorf-Sieg). Das verhindern wir,
  // bevor der State angefasst wird (sonst bliebe eine halb gestartete Runde übrig).
  const n = connectedPlayers.length;
  const roles = distributeRoles(state.rules, n);
  if (!roles.includes("werwolf")) return { ok: false, error: "no_werewolf" };

  state.round = 1;
  state.night = null;
  state.day = null;
  state.gameLog = [];
  state.winner = null;
  state.witchUsedHeal = false;
  state.witchUsedPoison = false;
  state.lastProtectedId = null;
  state.jaegerSourceId = null;
  state.jaegerQueue = [];

  connectedPlayers.forEach((p, i) => {
    p.role = roles[i] ?? "dorfbewohner";
    p.isAlive = true;
    p.isMayor = false;
    p.inLove = false;
    p.lovePartnerId = null;
    p.bountyTargetId = null;
    p.elderUsedLife = false;
    p.idiotRevealed = false;
  });

  // Kopfgeldjäger: feste Zielperson zu Spielbeginn auslosen (eine andere
  // mitspielende Person). Trifft das Dorf genau diese Person per Abstimmung,
  // gewinnt der Kopfgeldjäger sofort – egal, was sonst passiert.
  connectedPlayers
    .filter((p) => p.role === "kopfgeldjaeger")
    .forEach((hunter) => {
      const candidates = connectedPlayers.filter((p) => p.playerId !== hunter.playerId);
      if (candidates.length > 0) {
        hunter.bountyTargetId = candidates[Math.floor(Math.random() * candidates.length)].playerId;
      }
    });
  state.players
    .filter((p) => !p.isHost && !p.isConnected)
    .forEach((p) => {
      p.role = null;
      p.isAlive = false;
      p.isMayor = false;
    });

  state.players.filter(p => p.isHost).forEach(p => {
    p.role = "moderator";
    p.isAlive = true; // Host should always be alive
    p.isMayor = false;
  });

  if (state.rules.mayorElectionEnabled) {
    state.phase = "mayor_election";
    state.mayorElection = {
      candidateIds: connectedPlayers.map((p) => p.playerId),
      votes: {},
      round: 1,
      status: "voting",
      mayorId: null,
    };
  } else {
    state.phase = "night";
    state.mayorElection = null;
    state.night = createNightState();
  }
  schedulePersist();
  return { ok: true };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Bürgermeisterwahl: Stimme abgeben. Host darf nicht abstimmen.
 */
export function submitMayorVote(playerId, targetPlayerId) {
  if (state.phase !== "mayor_election" || !state.mayorElection)
    return { ok: false, error: "invalid_phase" };
  const p = findPlayer(playerId);
  if (!p || !p.isAlive) return { ok: false, error: "not_allowed" };
  if (p.isHost) return { ok: false, error: "host_does_not_vote" };
  if (p.idiotRevealed) return { ok: false, error: "idiot_cannot_vote" };
  const target = findPlayer(targetPlayerId);
  if (!target || !state.mayorElection.candidateIds.includes(targetPlayerId))
    return { ok: false, error: "invalid_target" };
  state.mayorElection.votes[playerId] = targetPlayerId;
  return { ok: true };
}

/**
 * Host oder Admin beendet Bürgermeisterwahl (nächste Phase oder Stichwahl).
 * Vereinfacht: Einfach Mehrheit; bei Gleichstand Stichwahl (Implementierung Schritt 3).
 */
export function finishMayorElection(hostPlayerId) {
  const host = findPlayer(hostPlayerId);
  if (!host || (!host.isHost && !host.isAdmin)) return { ok: false, error: "not_host" };
  if (state.phase !== "mayor_election" || !state.mayorElection)
    return { ok: false, error: "invalid_phase" };

  if (state.mayorElection.status === "decided") {
    if (state.day?.pendingTieResolution) {
      state.day.pendingTieResolution = false;
      state.phase = "day";
      schedulePersist();
      return { ok: true, backToDay: true };
    }
    state.phase = "night";
    state.night = createNightState();
    state.day = null;
    schedulePersist();
    return { ok: true, toNight: true };
  }

  const votes = state.mayorElection.votes;
  const count = {};
  for (const id of state.mayorElection.candidateIds) count[id] = 0;
  for (const targetId of Object.values(votes)) {
    if (targetId) count[targetId] = (count[targetId] || 0) + 1;
  }
  const maxVotes = Math.max(...Object.values(count), 0);
  const winners = Object.entries(count)
    .filter(([, v]) => v === maxVotes)
    .map(([id]) => id);

  if (winners.length === 1) {
    const mayorId = winners[0];
    state.players.forEach((p) => (p.isMayor = p.playerId === mayorId));
    state.mayorElection.status = "decided";
    state.mayorElection.mayorId = mayorId;
    schedulePersist();
    return { ok: true, mayorId, decided: true };
  }

  if (winners.length > 1) {
    // Wenn niemand gewählt hat (alle Stimmen = 0), gibt es keinen Bürgermeister,
    // egal ob das ein erster Gleichstand oder eine Stichwahl ist.
    if (maxVotes === 0) {
      state.mayorElection.status = "decided";
      state.mayorElection.mayorId = null;
      state.players.forEach((p) => (p.isMayor = false));
      schedulePersist();
      return { ok: true, decided: true, mayorId: null };
    }
    if (state.mayorElection.status === "tie_redo") {
      state.mayorElection.status = "decided";
      state.mayorElection.mayorId = null;
      state.players.forEach((p) => (p.isMayor = false));
      schedulePersist();
      return { ok: true, decided: true, mayorId: null };
    }
    state.mayorElection.status = "tie_redo";
    state.mayorElection.candidateIds = winners;
    state.mayorElection.votes = {};
    schedulePersist();
    return { ok: true, tie: true };
  }

  if (maxVotes === 0 || winners.length === 0) {
    state.mayorElection.status = "decided";
    state.mayorElection.mayorId = null;
    schedulePersist();
    return { ok: true, decided: true, mayorId: null };
  }

  return { ok: false, error: "no_votes" };
}

// --- Nacht & Tag: Aktionen und Phasenwechsel ---

/**
 * Baut die Nacht-Subphasen dynamisch: Nur Rollen, die noch leben (und etwas tun
 * können), bekommen eine Subphase. Werwölfe sind immer der Anker (Host gibt das
 * Opfer ein). So muss der Host nicht durch leere Phasen klicken.
 */
function getNightSubphases() {
  const aliveWithRole = (role) => state.players.some((p) => p.role === role && p.isAlive);
  const subs = [];
  // Amor wählt nur in der ersten Nacht das Liebespaar.
  if (state.round === 1 && aliveWithRole("amor")) subs.push("amor");
  // Der Beschützer legt seine schützende Hand auf, bevor die Werwölfe zuschlagen.
  if (aliveWithRole("beschuetzer")) subs.push("beschuetzer");
  subs.push("werwolf");
  if (aliveWithRole("seher")) subs.push("seher");
  // Hexe nur, wenn sie lebt und noch mindestens einen Trank besitzt.
  if (aliveWithRole("hexe") && (!state.witchUsedHeal || !state.witchUsedPoison)) subs.push("hexe");
  if (aliveWithRole("baecker")) subs.push("baecker");
  return subs;
}

function createNightState() {
  return {
    round: state.round,
    subPhase: getNightSubphases()[0],
    actions: {
      werwolf: { targetId: null },
      seher: { targetId: null },
      hexe: { healId: null, poisonId: null },
      baecker: { targetId: null },
      beschuetzer: { targetId: null },
      amor: { lover1Id: null, lover2Id: null },
    },
    victimId: null,
  };
}

/**
 * Host oder Admin: Bürgermeister festlegen (ohne Abstimmung) und zur nächsten Phase.
 */
export function hostSetMayor(hostPlayerId, mayorPlayerId) {
  const host = findPlayer(hostPlayerId);
  if (!host || (!host.isHost && !host.isAdmin)) return { ok: false, error: "not_host" };
  if (state.phase !== "mayor_election" || !state.mayorElection)
    return { ok: false, error: "invalid_phase" };
  if (mayorPlayerId) {
    const target = findPlayer(mayorPlayerId);
    if (!target || !target.isAlive || target.isHost) return { ok: false, error: "invalid_target" };
  }
  state.players.forEach((p) => (p.isMayor = p.playerId === mayorPlayerId));
  state.mayorElection.status = "decided";
  state.mayorElection.mayorId = mayorPlayerId;
  if (state.day?.pendingTieResolution) {
    state.day.pendingTieResolution = false;
    state.phase = "day";
    schedulePersist();
    return { ok: true, phase: "day", mayorId: mayorPlayerId };
  }
  state.phase = "night";
  state.night = createNightState();
  state.day = null;
  schedulePersist();
  return { ok: true, phase: "night", mayorId: mayorPlayerId };
}

/**
 * Host oder Admin: Aktuelle Phase/Subphase überspringen (z. B. Seher nicht da).
 */
export function hostSkipPhase(hostPlayerId) {
  const host = findPlayer(hostPlayerId);
  if (!host || (!host.isHost && !host.isAdmin)) return { ok: false, error: "not_host" };
  if (state.phase === "night" && state.night) {
    const subphases = getNightSubphases();
    const idx = subphases.indexOf(state.night.subPhase);
    if (idx < subphases.length - 1) {
      state.night.subPhase = subphases[idx + 1];
      schedulePersist();
      return { ok: true, subPhase: state.night.subPhase };
    }
    return advanceNightPhase(hostPlayerId);
  }
  if (state.phase === "mayor_election") {
    return hostSetMayor(hostPlayerId, null);
  }
  if (state.phase === "day" && state.day && state.day.status !== "decided") {
    state.day.status = "decided";
    state.day.eliminatedId = null;
    state.phase = "result";
    schedulePersist();
    return { ok: true, phase: "result" };
  }
  return { ok: false, error: "invalid_phase" };
}

/**
 * Nachtaktion abgeben (Werwolf-Ziel, Seher-Ziel, Hexe Heil/Gift).
 */
export function submitNightAction(playerId, payload) {
  if (state.phase !== "night" || !state.night) return { ok: false, error: "invalid_phase" };
  const p = findPlayer(playerId);
  if (!p || (!p.isAlive && !p.isHost)) return { ok: false, error: "not_allowed" };
  const sub = state.night.subPhase;
  const actions = state.night.actions;

  if (p.role === "amor" && sub === "amor") {
    const lover1Id = payload?.lover1Id ?? payload?.targetId;
    const lover2Id = payload?.lover2Id;
    if (lover1Id && lover2Id && lover1Id !== lover2Id) {
      const p1 = findPlayer(lover1Id);
      const p2 = findPlayer(lover2Id);
      if (p1?.isAlive && !p1?.isHost && p2?.isAlive && !p2?.isHost) {
        // Vorherige Auswahl zurücksetzen, falls Amor das Paar noch einmal ändert –
        // sonst blieben alte Verliebte fälschlich „verliebt".
        state.players.forEach((pl) => {
          pl.inLove = false;
          pl.lovePartnerId = null;
        });
        state.night.actions.amor = state.night.actions.amor || {};
        state.night.actions.amor.lover1Id = lover1Id;
        state.night.actions.amor.lover2Id = lover2Id;
        p1.inLove = true;
        p2.inLove = true;
        p1.lovePartnerId = p2.playerId;
        p2.lovePartnerId = p1.playerId;
      }
    }
    return { ok: true };
  }
  if (p.isHost && sub === "werwolf") {
    const targetId = payload?.targetId ?? payload?.targetPlayerId;
    const target = findPlayer(targetId);
    if (targetId && target?.isAlive && !target.isHost && targetId !== p.playerId)
      actions.werwolf.targetId = targetId;
    return { ok: true };
  }
  if (p.role === "seher" && sub === "seher") {
    const targetId = payload?.targetId ?? payload?.targetPlayerId;
    const targetPlayer = findPlayer(targetId);
    // Die Spielleitung (Moderator) ist kein Mitspieler und darf nicht geprüft werden.
    if (targetId && targetPlayer?.isAlive && !targetPlayer.isHost && targetPlayer.role !== "moderator") {
      actions.seher.targetId = targetId;
      if (state.rules.seherMode === "exact_role") {
        actions.seher.exactRole = targetPlayer?.role;
      } else {
        actions.seher.isTargetEvil = targetPlayer?.role === "werwolf";
      }
      return { ok: true };
    }
    return { ok: true };
  }
  if (p.role === "baecker" && sub === "baecker") {
    actions.baecker = actions.baecker || {};
    const targetId = payload?.targetId ?? payload?.targetPlayerId;
    if (targetId === null || targetId === undefined) {
      actions.baecker.targetId = null;
      actions.baecker.passed = true;
      return { ok: true };
    }
    const target = findPlayer(targetId);
    if (target && target.isAlive && !target.isHost) {
      actions.baecker.targetId = targetId;
      actions.baecker.passed = false;
    }
    return { ok: true };
  }
  if (p.role === "beschuetzer" && sub === "beschuetzer") {
    actions.beschuetzer = actions.beschuetzer || {};
    const targetId = payload?.targetId ?? payload?.targetPlayerId;
    // Bewusst niemanden schützen („passen") ist erlaubt – so muss der Host
    // die Phase nicht überspringen.
    if (targetId === null || targetId === undefined) {
      actions.beschuetzer.targetId = null;
      actions.beschuetzer.passed = true;
      return { ok: true };
    }
    const target = findPlayer(targetId);
    // Schützen: lebende Person (auch sich selbst), aber nicht die Spielleitung
    // und nicht dieselbe Person wie in der vergangenen Nacht.
    if (
      target?.isAlive &&
      !target.isHost &&
      target.role !== "moderator" &&
      targetId !== state.lastProtectedId
    ) {
      actions.beschuetzer.targetId = targetId;
      actions.beschuetzer.passed = false;
    }
    return { ok: true };
  }
  if (p.role === "hexe" && sub === "hexe") {
    const healId = payload?.healId ?? payload?.heal;
    const poisonId = payload?.poisonId ?? payload?.poison;
    // Heiltrank: nur auf das aktuelle Werwolf-Opfer, einmal pro Partie.
    if (healId) {
      if (state.witchUsedHeal) return { ok: false, error: "hexe_heal_used" };
      const werwolfTarget = state.night.actions.werwolf?.targetId;
      if (!werwolfTarget || healId !== werwolfTarget) return { ok: false, error: "hexe_can_only_heal_victim" };
      if (findPlayer(healId)?.isAlive) actions.hexe.healId = healId;
    } else {
      actions.hexe.healId = null;
    }
    // Gifttrank: auf eine beliebige lebende Person (nicht die Spielleitung), einmal pro Partie.
    if (poisonId) {
      if (state.witchUsedPoison) return { ok: false, error: "hexe_poison_used" };
      const poisonTarget = findPlayer(poisonId);
      if (poisonTarget?.isAlive && !poisonTarget.isHost && poisonTarget.role !== "moderator") {
        actions.hexe.poisonId = poisonId;
      }
    } else {
      actions.hexe.poisonId = null;
    }
    // „Passen" = bewusst keinen Trank einsetzen.
    actions.hexe.passed = !healId && !poisonId;
    return { ok: true };
  }
  return { ok: false, error: "no_action" };
}

/**
 * Host oder Admin: Nächste Nacht-Subphase oder Nacht beenden → Tag.
 */
export function advanceNightPhase(hostPlayerId) {
  const host = findPlayer(hostPlayerId);
  if (!host || (!host.isHost && !host.isAdmin)) return { ok: false, error: "not_host" };
  if (state.phase !== "night" || !state.night) return { ok: false, error: "invalid_phase" };

  const subphases = getNightSubphases();
  const idx = subphases.indexOf(state.night.subPhase);
  if (idx < subphases.length - 1) {
    state.night.subPhase = subphases[idx + 1];
    schedulePersist();
    return { ok: true, subPhase: state.night.subPhase };
  }

  // Nacht beenden: Opfer ermitteln (Werwolf-Ziel, Hexe heilt/vergiftet)
  const actions = state.night.actions;
  let victimId = actions.werwolf?.targetId || null;
  // Alle in dieser Nacht gestorbenen Jäger sammeln – jeder von ihnen darf
  // schießen (nacheinander), nicht nur der zuletzt gestorbene.
  const deadJaegers = [];
  const healId = state.night.actions.hexe?.healId;
  const poisonId = state.night.actions.hexe?.poisonId;

  // Beschützer: hat er das Werwolf-Opfer abgeschirmt, überlebt es die Nacht.
  // Der Gifttrank der Hexe durchdringt den Schutz hingegen weiterhin.
  const protectedId = actions.beschuetzer?.targetId || null;
  // Nur eine tatsächlich geschützte Person sperrt die nächste Nacht. Schützt der
  // Beschützer niemanden, wird die Sperre aufgehoben (sonst bliebe ein altes Ziel
  // dauerhaft blockiert, auch viele Nächte später).
  state.lastProtectedId = protectedId;
  if (protectedId && victimId === protectedId) {
    victimId = null;
  }

  // Der Älteste übersteht den ersten Werwolf-Angriff der Partie. Das passiert
  // still (kein Log-Eintrag), damit das Dorf seine Identität nicht erfährt.
  // Gift der Hexe, Abstimmung und Jäger-Schuss treffen ihn dagegen normal.
  if (victimId) {
    const elderVictim = findPlayer(victimId);
    if (elderVictim?.role === "aelteste" && !elderVictim.elderUsedLife) {
      elderVictim.elderUsedLife = true;
      victimId = null;
    }
  }

  if (healId && victimId === healId) {
    victimId = null;
    state.witchUsedHeal = true;
  }
  if (poisonId) {
    state.witchUsedPoison = true;
    const poisonVictim = findPlayer(poisonId);
    if (poisonVictim?.isAlive) {
      poisonVictim.isAlive = false;
      if (poisonVictim.role === "jaeger") deadJaegers.push(poisonVictim.playerId);
      addGameLog(state.round, "night", "victim_hexe", poisonVictim.name);
      const poisonLoverId = cascadeLover(poisonId, "night");
      if (poisonLoverId && findPlayer(poisonLoverId)?.role === "jaeger") {
        deadJaegers.push(poisonLoverId);
      }
    }
  }
  if (victimId) {
    const victim = findPlayer(victimId);
    if (victim?.isAlive) {
      victim.isAlive = false;
      if (victim.role === "jaeger") deadJaegers.push(victim.playerId);
      state.night.victimId = victimId;
      addGameLog(state.round, "night", "victim_werwolf", victim.name);
      const werwolfLoverId = cascadeLover(victimId, "night");
      if (werwolfLoverId && findPlayer(werwolfLoverId)?.role === "jaeger") {
        deadJaegers.push(werwolfLoverId);
      }
    }
  }

  // Stirbt der Jäger in der Nacht, schießt er ZUERST – sein Schuss kann den
  // Spielausgang noch drehen (z. B. den letzten Werwolf treffen). Erst danach
  // (in submitJaegerKill) wird die Siegbedingung geprüft. Würde hier zuerst der
  // Sieg ermittelt, ginge der entscheidende Schuss des Jägers verloren – genau
  // so handhabt es auch die Tag-Auswertung.
  if (deadJaegers.length > 0 && hasJaegerTarget()) {
    state.jaegerSourceId = deadJaegers[0];
    state.jaegerQueue = deadJaegers.slice(1);
    state.phase = "jaeger_shot";
    schedulePersist();
    return { ok: true, phase: "jaeger_shot", jaegerShot: true, jaegerSourceId: state.jaegerSourceId };
  }

  const nightWinner = checkWinCondition();
  if (nightWinner) {
    state.phase = "game_end";
    state.winner = nightWinner;
    schedulePersist();
    return { ok: true, phase: "game_end", winner: nightWinner };
  }

  state.phase = "day";
  state.day = {
    round: state.round,
    status: "accusing",
    accusations: {},
    votes: {},
    eliminatedId: null,
    runoffCandidates: null,
    accusedIds: null,
    tieResolution: null,
    silencedPlayerId: state.night.actions.baecker?.targetId || null,
  };
  schedulePersist();
  return { ok: true, phase: "day", victimId };
}

function addGameLog(round, phase, messageKey, playerName) {
  state.gameLog.push({
    round,
    phase,
    messageKey,
    playerName: playerName ?? null,
    at: new Date().toISOString(),
  });
  // Protokoll begrenzen, damit der State (Broadcast + Persistenz) nicht unbegrenzt wächst.
  if (state.gameLog.length > MAX_GAME_LOG_ENTRIES) {
    state.gameLog.splice(0, state.gameLog.length - MAX_GAME_LOG_ENTRIES);
  }
}

function cascadeLover(deadPlayerId, phase) {
  const dead = findPlayer(deadPlayerId);
  if (!dead?.inLove) return null;
  const partner = state.players.find(
    (p) => p.inLove && p.isAlive && p.playerId !== deadPlayerId
  );
  if (!partner) return null;
  partner.isAlive = false;
  addGameLog(state.round, phase, "lover_death", partner.name);
  return partner.playerId;
}

/**
 * Anklage abgeben (Phase "accusing"). Jeder lebende Nicht-Host kann eine Person anklagen oder niemanden.
 */
export function submitDayAccusation(playerId, targetPlayerId) {
  if (state.phase !== "day" || !state.day || state.day.status !== "accusing") return { ok: false, error: "invalid_phase" };
  const p = findPlayer(playerId);
  if (!p || !p.isAlive) return { ok: false, error: "not_allowed" };
  if (p.isHost) return { ok: false, error: "host_does_not_vote" };
  if (state.day.silencedPlayerId === playerId) return { ok: false, error: "silenced" };
  if (targetPlayerId === null || targetPlayerId === undefined) {
    state.day.accusations[playerId] = null;
    return { ok: true };
  }
  const target = findPlayer(targetPlayerId);
  if (!target || !target.isAlive || target.isHost) return { ok: false, error: "invalid_target" };
  state.day.accusations[playerId] = targetPlayerId;
  return { ok: true };
}

/**
 * Tagesabstimmung: Stimme abgeben (nur in Phase "voting"). Host darf nicht abstimmen. Stummgeschaltete können nicht abstimmen.
 */
export function submitDayVote(playerId, targetPlayerId) {
  if (state.phase !== "day" || !state.day) return { ok: false, error: "invalid_phase" };
  if (state.day.status === "accusing") return { ok: false, error: "still_accusing" };
  // Nach der Auswertung („decided") sind keine Stimmen mehr zulässig – sonst
  // ließe sich das angezeigte Ergebnis nachträglich verfälschen.
  if (state.day.status !== "voting") return { ok: false, error: "voting_closed" };
  const p = findPlayer(playerId);
  if (!p || !p.isAlive) return { ok: false, error: "not_allowed" };
  if (p.isHost) return { ok: false, error: "host_does_not_vote" };
  if (p.idiotRevealed) return { ok: false, error: "idiot_cannot_vote" };
  if (state.day.silencedPlayerId === playerId) return { ok: false, error: "silenced" };
  if (targetPlayerId === null || targetPlayerId === undefined) {
    state.day.votes[playerId] = null;
    return { ok: true };
  }
  const target = findPlayer(targetPlayerId);
  if (!target || !target.isAlive) return { ok: false, error: "invalid_target" };
  const candidates = getDayVoteCandidates();
  if (!candidates.includes(targetPlayerId)) return { ok: false, error: "invalid_target" };
  state.day.votes[playerId] = targetPlayerId;
  return { ok: true };
}

function getDayVoteCandidates() {
  if (!state.day) return [];
  // Stichwahl hat Vorrang: läuft eine Runoff-Runde, darf nur noch über die
  // gleichstehenden Kandidaten abgestimmt werden – nicht mehr über alle Angeklagten.
  if (state.day.runoffCandidates && state.day.runoffCandidates.length > 0) return state.day.runoffCandidates;
  if (state.day.status === "voting" && Array.isArray(state.day.accusedIds)) return state.day.accusedIds;
  return state.players.filter((x) => x.isAlive && !x.isHost).map((x) => x.playerId);
}

/**
 * Zählt Stimmen inkl. Bürgermeister-Regel: Normal 1 Stimme; bei Gleichstand zählt Bürgermeister-Stimme doppelt.
 * @returns { { eliminatedId: string | null, tie: boolean, runoff?: string[], needMayorElection?: boolean } }
 */
function countDayVotes() {
  const candidates = getDayVoteCandidates();
  const votes = state.day.votes;
  const mayor = state.players.find((p) => p.isMayor && p.isAlive);
  const count = {};
  for (const id of candidates) count[id] = 0;
  for (const voterId of Object.keys(votes)) {
    if (state.day.silencedPlayerId === voterId) continue;
    if (findPlayer(voterId)?.idiotRevealed) continue;
    const targetId = votes[voterId];
    if (targetId && candidates.includes(targetId)) count[targetId] = (count[targetId] || 0) + 1;
  }
  const maxVotes = Math.max(...Object.values(count), 0);
  // Hat niemand abgestimmt, wird auch niemand hingerichtet. Ohne diese Sperre
  // würde bei nur einer angeklagten Person diese selbst mit null Stimmen
  // „gewinnen" und fälschlich ausscheiden.
  if (maxVotes === 0) return { eliminatedId: null, tie: false };
  const winners = Object.entries(count)
    .filter(([, v]) => v === maxVotes)
    .map(([id]) => id);

  if (winners.length === 0) return { eliminatedId: null, tie: false };
  if (winners.length === 1) return { eliminatedId: winners[0], tie: false };

  // Gleichstand: zuerst Stichwahl
  if (!state.day.runoffCandidates) {
    return { eliminatedId: null, tie: true, runoff: winners };
  }
  // Stichwahl-Gleichstand: Bürgermeister-Stimme zählt doppelt (nur hier).
  // Nur wenn die Bürgermeister-Stimme den Gleichstand tatsächlich auflöst,
  // scheidet jemand aus – sonst würde willkürlich die zuerst gelistete Person
  // „gewinnen", obwohl alle gleich viele Stimmen haben.
  if (mayor) {
    const mayorVote = votes[mayor.playerId];
    if (mayorVote && winners.includes(mayorVote)) {
      return { eliminatedId: mayorVote, tie: false };
    }
    return { eliminatedId: null, tie: true };
  }
  // Kein Bürgermeister oder hat nicht unter Kandidaten gewählt → Bürgermeisterwahl nötig (oder Zufall bei deaktiviert)
  return { eliminatedId: null, tie: true, needMayorElection: !mayor, tiedWinnerIds: winners };
}

/**
 * Wendet eine Tages-Hinrichtung an: Dorfdepp-Begnadigung, Kopfgeld-Sieg,
 * Liebes-Kaskade und Jäger-Schüsse werden zentral behandelt, damit normale
 * Auswertung und Zufalls-Gleichstand identisch funktionieren.
 * @returns {{ type: "none"|"idiot"|"bounty"|"jaeger"|"eliminated", deadJaegers?: string[] }}
 */
function applyDayElimination(eliminatedId) {
  const eliminated = findPlayer(eliminatedId);
  if (!eliminated?.isAlive) return { type: "none" };

  // Dorfdepp: Das Dorf erkennt seinen Irrtum – der Depp überlebt die Wahl,
  // verliert aber für den Rest der Partie sein Stimmrecht.
  if (eliminated.role === "dorfdepp" && !eliminated.idiotRevealed) {
    eliminated.idiotRevealed = true;
    addGameLog(state.round, "day", "idiot_revealed", eliminated.name);
    return { type: "idiot" };
  }

  eliminated.isAlive = false;
  state.day.eliminatedId = eliminatedId;
  addGameLog(state.round, "day", "lynch", eliminated.name);

  if (checkBountyWin(eliminatedId)) return { type: "bounty" };

  const loverId = cascadeLover(eliminatedId, "day");
  const deadJaegers = [];
  if (eliminated.role === "jaeger") deadJaegers.push(eliminatedId);
  if (loverId && findPlayer(loverId)?.role === "jaeger") deadJaegers.push(loverId);
  if (deadJaegers.length > 0 && hasJaegerTarget()) {
    return { type: "jaeger", deadJaegers };
  }
  return { type: "eliminated" };
}

/**
 * Host oder Admin: Tagesabstimmung auswerten (oder Stichwahl starten / Bürgermeister-Regel anwenden).
 */
export function resolveDayPhase(hostPlayerId) {
  const host = findPlayer(hostPlayerId);
  if (!host || (!host.isHost && !host.isAdmin)) return { ok: false, error: "not_host" };
  if (state.phase !== "day" || !state.day) return { ok: false, error: "invalid_phase" };

  if (state.day.status === "decided") {
    state.phase = "result";
    schedulePersist();
    return { ok: true, phase: "result", eliminatedId: state.day.eliminatedId };
  }

  if (state.day.status === "accusing") {
    const accusedIds = [...new Set(Object.values(state.day.accusations).filter(Boolean))].filter(
      (id) => findPlayer(id)?.isAlive && !findPlayer(id)?.isHost
    );
    state.day.accusedIds = accusedIds;
    state.day.status = "voting";
    state.day.votes = {};
    state.day.votingStartedAt = new Date().toISOString();
    schedulePersist();
    return { ok: true, accusedIds };
  }

  const candidates = getDayVoteCandidates();
  if (candidates.length === 0) {
    state.day.status = "decided";
    state.day.eliminatedId = null;
    state.phase = "result";
    schedulePersist();
    return { ok: true, phase: "result", eliminatedId: null };
  }

  const result = countDayVotes();

  if (result.runoff) {
    state.day.runoffCandidates = result.runoff;
    state.day.votes = {};
    state.day.tieResolution = "runoff";
    schedulePersist();
    return { ok: true, runoff: true };
  }

  if (result.needMayorElection && state.rules.mayorElectionEnabled) {
    state.phase = "mayor_election";
    state.mayorElection = {
      // Die Spielleitung (Host/Moderator) ist kein Mitspieler und darf weder
      // kandidieren noch zum Bürgermeister gewählt werden.
      candidateIds: state.players.filter((p) => p.isAlive && !p.isHost).map((p) => p.playerId),
      votes: {},
      round: state.mayorElection?.round ?? 1,
      status: "voting",
      mayorId: null,
    };
    state.day.pendingTieResolution = true;
    state.day.votes = {};
    schedulePersist();
    return { ok: true, needMayorElection: true };
  }
  if (result.needMayorElection && !state.rules.mayorElectionEnabled && result.tiedWinnerIds?.length) {
    const tied = result.tiedWinnerIds;
    const randomIndex = Math.floor(Math.random() * tied.length);
    const eliminatedId = tied[randomIndex];
    state.day.status = "decided";
    state.day.tieResolution = "random";
    state.day.runoffCandidates = null;
    const outcome = applyDayElimination(eliminatedId);
    if (outcome.type === "bounty") {
      state.phase = "game_end";
      state.winner = "kopfgeldjaeger";
      schedulePersist();
      return { ok: true, decided: true, eliminatedId, winner: "kopfgeldjaeger" };
    }
    if (outcome.type === "jaeger") {
      state.phase = "jaeger_shot";
      state.jaegerSourceId = outcome.deadJaegers[0];
      state.jaegerQueue = outcome.deadJaegers.slice(1);
      schedulePersist();
      return { ok: true, phase: "jaeger_shot", jaegerShot: true, eliminatedId };
    }
    schedulePersist();
    return {
      ok: true,
      decided: true,
      eliminatedId: outcome.type === "idiot" || outcome.type === "none" ? null : eliminatedId,
      idiotRevealed: outcome.type === "idiot" ? eliminatedId : undefined,
    };
  }

  let idiotRevealedId;
  if (result.eliminatedId) {
    const outcome = applyDayElimination(result.eliminatedId);
    if (outcome.type === "idiot") {
      idiotRevealedId = result.eliminatedId;
      result.eliminatedId = null;
    }
    if (outcome.type === "bounty") {
      state.day.status = "decided";
      state.phase = "game_end";
      state.winner = "kopfgeldjaeger";
      schedulePersist();
      return { ok: true, decided: true, eliminatedId: result.eliminatedId, winner: "kopfgeldjaeger" };
    }
    if (outcome.type === "jaeger") {
      state.day.status = "decided";
      state.phase = "jaeger_shot";
      state.jaegerSourceId = outcome.deadJaegers[0];
      state.jaegerQueue = outcome.deadJaegers.slice(1);
      schedulePersist();
      return { ok: true, phase: "jaeger_shot", jaegerShot: true, eliminatedId: result.eliminatedId };
    }
  }

  const dayWinner = checkWinCondition();
  if (dayWinner) {
    state.day.status = "decided";
    state.phase = "game_end";
    state.winner = dayWinner;
    schedulePersist();
    return { ok: true, decided: true, phase: "game_end", winner: dayWinner, eliminatedId: state.day.eliminatedId };
  }

  state.day.status = "decided";
  state.day.tieResolution = result.tie ? "mayor_decides" : null;
  state.phase = "result";
  schedulePersist();
  return { ok: true, decided: true, phase: "result", eliminatedId: result.eliminatedId, idiotRevealed: idiotRevealedId };
}

/**
 * Host oder Admin: Jäger-Schuss ausführen (nach Tod des Jägers am Tag).
 */
export function submitJaegerKill(hostPlayerId, targetId) {
  const host = findPlayer(hostPlayerId);
  if (!host || (!host.isHost && !host.isAdmin)) return { ok: false, error: "not_host" };
  if (state.phase !== "jaeger_shot" || !state.jaegerSourceId) return { ok: false, error: "invalid_phase" };
  const target = findPlayer(targetId);
  if (!target || !target.isAlive || target.isHost || target.role === "moderator") return { ok: false, error: "invalid_target" };
  target.isAlive = false;
  addGameLog(state.round, "day", "jaeger_shot", target.name);
  const nightCase = !state.day;

  const loverId = cascadeLover(targetId, nightCase ? "night" : "day");

  // Trifft der Schuss (oder die Liebes-Kaskade) einen weiteren Jäger, reiht
  // dieser sich für den nächsten Schuss ein – Kettenschüsse sind erlaubt.
  state.jaegerQueue = state.jaegerQueue || [];
  if (target.role === "jaeger") state.jaegerQueue.push(targetId);
  if (loverId && findPlayer(loverId)?.role === "jaeger") state.jaegerQueue.push(loverId);

  if (state.jaegerQueue.length > 0 && hasJaegerTarget()) {
    state.jaegerSourceId = state.jaegerQueue.shift();
    schedulePersist();
    return { ok: true, phase: "jaeger_shot", jaegerShot: true, jaegerKillId: targetId, jaegerSourceId: state.jaegerSourceId };
  }
  state.jaegerQueue = [];

  const jaegerWinner = checkWinCondition();
  if (jaegerWinner) {
    if (!nightCase) {
      state.day = state.day || {};
      state.day.jaegerKillId = targetId;
    }
    state.phase = "game_end";
    state.winner = jaegerWinner;
    state.jaegerSourceId = null;
    schedulePersist();
    return { ok: true, phase: "game_end", winner: jaegerWinner, jaegerKillId: targetId };
  }

  if (nightCase) {
    // Jäger ist nachts gestorben -> danach startet der Tag (Anklagen).
    state.jaegerSourceId = null;
    state.phase = "day";
    state.day = {
      round: state.round,
      status: "accusing",
      accusations: {},
      votes: {},
      eliminatedId: null,
      runoffCandidates: null,
      accusedIds: null,
      tieResolution: null,
      silencedPlayerId: state.night?.actions?.baecker?.targetId || null,
    };
    schedulePersist();
    return { ok: true, phase: "day", jaegerKillId: targetId };
  }

  // Standard: Jäger starb am Tag und das Spiel geht in die Ergebnisphase.
  state.day = state.day || {};
  state.day.jaegerKillId = targetId;
  state.phase = "result";
  state.jaegerSourceId = null;
  schedulePersist();
  return { ok: true, phase: "result", jaegerKillId: targetId };
}

/**
 * Host oder Admin: Von Ergebnis-Phase in nächste Runde (Nacht) oder Spielende.
 */
export function advanceFromResult(hostPlayerId) {
  const host = findPlayer(hostPlayerId);
  if (!host || (!host.isHost && !host.isAdmin)) return { ok: false, error: "not_host" };
  if (state.phase !== "result") return { ok: false, error: "invalid_phase" };

  const winner = checkWinCondition();
  if (winner) {
    state.phase = "game_end";
    state.winner = winner;
    schedulePersist();
    return { ok: true, phase: "game_end", winner };
  }

  state.round += 1;
  state.phase = "night";
  state.night = createNightState();
  state.day = null;
  schedulePersist();
  return { ok: true, phase: "night", round: state.round };
}

/**
 * Gibt es überhaupt noch ein gültiges Ziel für den Jäger-Schuss? Ist nach allen
 * Todesfällen niemand Schießbares mehr übrig (nur noch Spielleitung/Tote), darf
 * nicht in die jaeger_shot-Phase gewechselt werden – sonst hinge der Host in
 * einer Auswahl ohne Optionen fest.
 */
function hasJaegerTarget() {
  return state.players.some((p) => p.isAlive && !p.isHost && p.role !== "moderator");
}

/**
 * Siegbedingungen: Werwölfe (alle anderen tot oder Gleichzahl), Dorf (keine Werwölfe mehr), Kopfgeldjäger (Ziel tot), Liebespaar (nur sie beide leben).
 */
/**
 * Kopfgeldjäger-Sieg: Wird genau die ausgeloste Zielperson vom Dorf
 * hinausgewählt, während der Kopfgeldjäger noch lebt, gewinnt er allein.
 */
function checkBountyWin(eliminatedId) {
  if (!eliminatedId) return null;
  const hunter = state.players.find(
    (p) => p.role === "kopfgeldjaeger" && p.isAlive && p.bountyTargetId === eliminatedId
  );
  return hunter ? "kopfgeldjaeger" : null;
}

function checkWinCondition() {
  // Moderator (Host) is not a real player — exclude from win checks.
  const alive = state.players.filter((p) => p.isAlive && p.role !== "moderator");
  const werewolves = alive.filter((p) => p.role === "werwolf");
  const nonWerewolves = alive.filter((p) => p.role !== "werwolf");

  // Liebespaar-Sieg: nur ein „gemischtes" Paar (ein Werwolf + ein Nicht-Werwolf),
  // das als letzte zwei übrig bleibt, gewinnt gemeinsam. Sind beide Werwölfe bzw.
  // beide Dorf, greift die normale Logik darunter (Werwolf- bzw. Dorfsieg).
  if (alive.length === 2 && alive[0].inLove && alive[1].inLove && werewolves.length === 1) {
    return "lovers";
  }

  // Werwölfe gewinnen, wenn sie die einzigen letzten Überlebenden sind.
  if (werewolves.length > 0 && werewolves.length >= nonWerewolves.length) return "werwolf";

  // Dorf gewinnt, wenn keine Werwölfe mehr leben (Liebespaar zählt dann als Dorf).
  if (werewolves.length === 0) return "village";

  return null;
}

/**
 * Spieler aus Raum entfernen (z. B. nach Ban).
 */
export function removePlayer(playerId) {
  const idx = state.players.findIndex((p) => p.playerId === playerId);
  if (idx === -1) return;
  state.players.splice(idx, 1);

  if (state.mayorElection) {
    state.mayorElection.candidateIds = (state.mayorElection.candidateIds || []).filter((id) => id !== playerId);
    if (state.mayorElection.votes) {
      delete state.mayorElection.votes[playerId];
      for (const [voterId, targetId] of Object.entries(state.mayorElection.votes)) {
        if (targetId === playerId) delete state.mayorElection.votes[voterId];
      }
    }
    if (state.mayorElection.mayorId === playerId) state.mayorElection.mayorId = null;
  }

  if (state.day) {
    if (state.day.accusations) {
      delete state.day.accusations[playerId];
      for (const [voterId, targetId] of Object.entries(state.day.accusations)) {
        if (targetId === playerId) delete state.day.accusations[voterId];
      }
    }
    if (state.day.votes) {
      delete state.day.votes[playerId];
      for (const [voterId, targetId] of Object.entries(state.day.votes)) {
        if (targetId === playerId) delete state.day.votes[voterId];
      }
    }
    if (Array.isArray(state.day.runoffCandidates)) {
      state.day.runoffCandidates = state.day.runoffCandidates.filter((id) => id !== playerId);
      if (state.day.runoffCandidates.length === 0) state.day.runoffCandidates = null;
    }
    if (Array.isArray(state.day.accusedIds)) {
      state.day.accusedIds = state.day.accusedIds.filter((id) => id !== playerId);
    }
    if (state.day.silencedPlayerId === playerId) state.day.silencedPlayerId = null;
    if (state.day.eliminatedId === playerId) state.day.eliminatedId = null;
  }

  if (state.night?.actions) {
    if (state.night.actions.werwolf?.targetId === playerId) state.night.actions.werwolf.targetId = null;
    if (state.night.actions.seher?.targetId === playerId) state.night.actions.seher.targetId = null;
    if (state.night.actions.hexe?.healId === playerId) state.night.actions.hexe.healId = null;
    if (state.night.actions.hexe?.poisonId === playerId) state.night.actions.hexe.poisonId = null;
    if (state.night.actions.baecker?.targetId === playerId) state.night.actions.baecker.targetId = null;
    if (state.night.actions.beschuetzer?.targetId === playerId) state.night.actions.beschuetzer.targetId = null;
    if (state.night.actions.amor?.lover1Id === playerId) state.night.actions.amor.lover1Id = null;
    if (state.night.actions.amor?.lover2Id === playerId) state.night.actions.amor.lover2Id = null;
  }

  // Kopfgeldjäger, dessen Zielperson den Raum verlässt, verliert sein Ziel.
  state.players.forEach((p) => {
    if (p.bountyTargetId === playerId) p.bountyTargetId = null;
  });

  if (state.lastProtectedId === playerId) state.lastProtectedId = null;
  if (state.jaegerSourceId === playerId) state.jaegerSourceId = null;
  if (Array.isArray(state.jaegerQueue)) {
    state.jaegerQueue = state.jaegerQueue.filter((id) => id !== playerId);
  }
  ensureHost();
  schedulePersist();
}

/**
 * Host oder Admin: Spieler kicken (ohne Bann). Nur in Lobby oder jederzeit.
 */
export function hostKick(actorPlayerId, targetPlayerId) {
  const actor = findPlayer(actorPlayerId);
  if (!actor || (!actor.isHost && !actor.isAdmin)) return { ok: false, error: "not_allowed" };
  const target = findPlayer(targetPlayerId);
  if (!target) return { ok: false, error: "player_not_found" };
  if (target.playerId === actorPlayerId) return { ok: false, error: "cannot_kick_self" };
  if (target.isAdmin) return { ok: false, error: "cannot_kick_admin" };
  removePlayer(targetPlayerId);
  schedulePersist();
  return { ok: true };
}

/**
 * Generiert ein neues Reconnect-Token.
 */
export function generateReconnectToken() {
  return randomUUID() + "-" + Math.random().toString(36).slice(2, 12);
}

/**
 * CLI/Server: Bann ohne Admin-Check aufheben.
 */
export function forceUnban(targetPlayerId) {
  const banData = bans.players.get(targetPlayerId);
  if (banData) {
    if (banData.fingerprint) bans.fingerprints.delete(banData.fingerprint);
    if (banData.ip) bans.ips.delete(banData.ip);
    bans.players.delete(targetPlayerId);
  }
}

/**
 * Nach Spielende: Zurück in Lobby (Spieler bleiben, neues Spiel kann starten).
 * Wird aufgerufen, wenn jemand nach game_end die Seite neu lädt oder neu beitritt.
 */
export function resetToLobbyAfterGameEnd() {
  if (state.phase !== "game_end") return;
  doResetToLobby();
  schedulePersist();
}

/** Gemeinsamer Reset in die Lobby (Spieler bleiben erhalten, Rollen werden gelöscht). */
function doResetToLobby() {
  state.phase = "lobby";
  state.mayorElection = null;
  state.night = null;
  state.day = null;
  state.gameLog = [];
  state.winner = null;
  state.round = 0;
  state.jaegerSourceId = null;
  state.jaegerQueue = [];
  state.witchUsedHeal = false;
  state.witchUsedPoison = false;
  state.lastProtectedId = null;
  state.players.forEach((p) => {
    p.role = null;
    p.isAlive = true;
    p.isMayor = false;
    p.inLove = false;
    p.lovePartnerId = null;
    p.bountyTargetId = null;
    p.elderUsedLife = false;
    p.idiotRevealed = false;
  });
}

/**
 * Host oder Admin: nach Spielende eine neue Runde mit denselben Spielern starten
 * (zurück in die Lobby). Funktioniert nur nach Spielende.
 */
export function restartToLobby(actorPlayerId) {
  const actor = findPlayer(actorPlayerId);
  if (!actor || (!actor.isHost && !actor.isAdmin)) return { ok: false, error: "not_host" };
  if (state.phase !== "game_end") return { ok: false, error: "invalid_phase" };
  doResetToLobby();
  schedulePersist();
  return { ok: true };
}

/**
 * CLI/Server: State komplett zurücksetzen (Lobby, keine Spieler).
 */
export function resetState() {
  state.phase = "lobby";
  state.roomCode = DEFAULT_ROOM_CODE;
  state.players = [];
  state.rules = structuredClone(DEFAULT_RULES);
  state.mayorElection = null;
  state.night = null;
  state.day = null;
  state.gameLog = [];
  state.winner = null;
  state.round = 0;
  state.jaegerSourceId = null;
  state.jaegerQueue = [];
  state.witchUsedHeal = false;
  state.witchUsedPoison = false;
  state.lastProtectedId = null;
  rotateInviteToken();
}

/**
 * CLI/Server: Spiel sofort beenden.
 */
export function endGameNow(winner = "village") {
  state.phase = "game_end";
  state.winner = winner;
  schedulePersist();
}
