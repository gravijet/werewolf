/**
 * In-Memory-Game-State für einen einzigen aktiven Spielraum.
 * Alle Änderungen gehen über diese Modul-API.
 */

import { randomUUID } from "crypto";
import { DEFAULT_ROOM_CODE, DEFAULT_RULES } from "./constants.js";
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

/**
 * State und Bans aus geladener Persistenz wiederherstellen.
 */
export function loadStateFromPersistence(data) {
  if (!data?.state) return;
  state = data.state;
  if (data.bans) {
    bans.players = new Map(Array.isArray(data.bans.players) ? data.bans.players : []);
    bans.fingerprints = new Set(data.bans.fingerprints || []);
    bans.ips = new Set(data.bans.ips || []);
  }
}

function schedulePersist() {
  try {
    persistence.save({ state: getStateForPersistence(), bans: getBansForPersistence() });
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
      outState.night.actions = {
        werwolf: { targetId: viewer?.role === 'werwolf' ? outState.night.actions.werwolf?.targetId : null },
        seher: { 
          targetId: viewer?.role === 'seher' ? outState.night.actions.seher?.targetId : null,
          isTargetEvil: viewer?.role === 'seher' ? outState.night.actions.seher?.isTargetEvil : null,
          exactRole: viewer?.role === 'seher' ? outState.night.actions.seher?.exactRole : null
        },
        hexe: { 
          healId: viewer?.role === 'hexe' ? outState.night.actions.hexe?.healId : null,
          poisonId: viewer?.role === 'hexe' ? outState.night.actions.hexe?.poisonId : null
        }
      };
    }
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
  const showRole = isViewer || isDeadViewer || isModerator;

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
    name: String(name).trim().slice(0, 80) || "Spieler",
    isAdmin: !!isAdmin,
    isHost: !!isHost,
    canChangeName: true,
    isConnected: true,
    isAlive: true,
    role: null,
    isMayor: false,
    reconnectToken,
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
  p.name = name;
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
  target.name = String(newName).trim().slice(0, 80) || target.name;
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
 * Admin: Spieler bannen (playerId + optional fingerprint/IP).
 */
export function adminBan(adminPlayerId, { targetPlayerId, fingerprint, ip }) {
  const admin = findPlayer(adminPlayerId);
  if (!admin || !admin.isAdmin) return { ok: false, error: "not_admin" };
  const target = findPlayer(targetPlayerId);
  if (!target) return { ok: false, error: "player_not_found" };
  if (target.isAdmin) return { ok: false, error: "cannot_ban_admin" };
  addBan({ playerId: targetPlayerId, name: target.name, fingerprint, ip });
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
    state.rules = { ...state.rules, ...newRules };
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
  
  const playingPlayers = state.players.filter(p => !p.isHost);
  const alive = playingPlayers.filter((p) => p.isConnected);
  if (alive.length < state.rules.minPlayers) return { ok: false, error: "not_enough_players" };

  state.round = 1;
  state.night = null;
  state.day = null;
  state.gameLog = [];
  state.winner = null;

  const n = playingPlayers.length;
  const roles = distributeRoles(state.rules, n);
  
  playingPlayers.forEach((p, i) => {
    p.role = roles[i] ?? "dorfbewohner";
    p.isAlive = true;
    p.isMayor = false;
  });

  state.players.filter(p => p.isHost).forEach(p => {
    p.role = "moderator";
    p.isAlive = false;
    p.isMayor = false;
  });

  if (state.rules.mayorElectionEnabled) {
    state.phase = "mayor_election";
    state.mayorElection = {
      candidateIds: playingPlayers.map((p) => p.playerId),
      votes: {},
      round: 1,
      status: "voting",
      mayorId: null,
    };
  } else {
    state.phase = "night";
    state.mayorElection = null;
    state.night = {
      round: state.round,
      subPhase: "werwolf",
      actions: { werwolf: { targetId: null }, seher: { targetId: null }, hexe: { healId: null, poisonId: null } },
      victimId: null,
    };
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
 * Bürgermeisterwahl: Stimme abgeben.
 */
export function submitMayorVote(playerId, targetPlayerId) {
  if (state.phase !== "mayor_election" || !state.mayorElection)
    return { ok: false, error: "invalid_phase" };
  const p = findPlayer(playerId);
  if (!p || !p.isAlive) return { ok: false, error: "not_allowed" };
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
    state.night = {
      round: state.round,
      subPhase: "werwolf",
      actions: { werwolf: { targetId: null }, seher: { targetId: null }, hexe: { healId: null, poisonId: null } },
      victimId: null,
    };
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
    state.mayorElection.status = "tie_redo";
    state.mayorElection.candidateIds = winners;
    state.mayorElection.votes = {};
    schedulePersist();
    return { ok: true, tie: true };
  }

  return { ok: false, error: "no_votes" };
}

// --- Nacht & Tag: Aktionen und Phasenwechsel ---

const NIGHT_SUBPHASES = ["werwolf", "hexe", "seher"];

/**
 * Nachtaktion abgeben (Werwolf-Ziel, Seher-Ziel, Hexe Heil/Gift).
 */
export function submitNightAction(playerId, payload) {
  if (state.phase !== "night" || !state.night) return { ok: false, error: "invalid_phase" };
  const p = findPlayer(playerId);
  if (!p || (!p.isAlive && !p.isHost)) return { ok: false, error: "not_allowed" };
  const sub = state.night.subPhase;
  const actions = state.night.actions;

  if (p.isHost && sub === "werwolf") {
    const targetId = payload?.targetId ?? payload?.targetPlayerId;
    if (targetId && findPlayer(targetId)?.isAlive && targetId !== p.playerId)
      actions.werwolf.targetId = targetId;
    return { ok: true };
  }
  if (p.role === "seher" && sub === "seher") {
    const targetId = payload?.targetId ?? payload?.targetPlayerId;
    if (targetId && findPlayer(targetId)?.isAlive) {
      actions.seher.targetId = targetId;
      const targetPlayer = findPlayer(targetId);
      if (state.rules.seherMode === "exact_role") {
        actions.seher.exactRole = targetPlayer?.role;
      } else {
        actions.seher.isTargetEvil = targetPlayer?.role === "werwolf";
      }
      return { ok: true };
    }
    return { ok: true };
  }
  if (p.role === "hexe" && sub === "hexe") {
    const healId = payload?.healId ?? payload?.heal;
    const poisonId = payload?.poisonId ?? payload?.poison;
    if (healId && findPlayer(healId)?.isAlive) actions.hexe.healId = healId;
    if (poisonId && findPlayer(poisonId)?.isAlive) actions.hexe.poisonId = poisonId;
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

  const idx = NIGHT_SUBPHASES.indexOf(state.night.subPhase);
  if (idx < NIGHT_SUBPHASES.length - 1) {
    state.night.subPhase = NIGHT_SUBPHASES[idx + 1];
    schedulePersist();
    return { ok: true, subPhase: state.night.subPhase };
  }

  // Nacht beenden: Opfer ermitteln (Werwolf-Ziel, Hexe heilt/vergiftet)
  const actions = state.night.actions;
  let victimId = actions.werwolf?.targetId || null;
  const healId = state.night.actions.hexe?.healId;
  const poisonId = state.night.actions.hexe?.poisonId;
  if (healId && victimId === healId) victimId = null;
  if (poisonId) {
    const poisonVictim = findPlayer(poisonId);
    if (poisonVictim?.isAlive) {
      poisonVictim.isAlive = false;
      addGameLog(state.round, "night", "victim_hexe", poisonVictim.name);
    }
  }
  if (victimId) {
    const victim = findPlayer(victimId);
    if (victim?.isAlive) {
      victim.isAlive = false;
      state.night.victimId = victimId;
      addGameLog(state.round, "night", "victim_werwolf", victim.name);
    }
  }

  state.phase = "day";
  state.day = {
    round: state.round,
    votes: {},
    eliminatedId: null,
    runoffCandidates: null,
    tieResolution: null,
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
}

/**
 * Tagesabstimmung: Stimme abgeben (nur lebende Spieler, ggf. nur Stichwahl-Kandidaten).
 */
export function submitDayVote(playerId, targetPlayerId) {
  if (state.phase !== "day" || !state.day) return { ok: false, error: "invalid_phase" };
  const p = findPlayer(playerId);
  if (!p || !p.isAlive) return { ok: false, error: "not_allowed" };
  const target = findPlayer(targetPlayerId);
  if (!target || !target.isAlive) return { ok: false, error: "invalid_target" };
  const candidates = state.day.runoffCandidates || state.players.filter((x) => x.isAlive).map((x) => x.playerId);
  if (!candidates.includes(targetPlayerId)) return { ok: false, error: "invalid_target" };
  state.day.votes[playerId] = targetPlayerId;
  return { ok: true };
}

/**
 * Zählt Stimmen inkl. Bürgermeister-Regel: Normal 1 Stimme; bei Gleichstand zählt Bürgermeister-Stimme doppelt.
 * @returns { { eliminatedId: string | null, tie: boolean, runoff?: string[], needMayorElection?: boolean } }
 */
function countDayVotes() {
  const candidates = state.day.runoffCandidates || state.players.filter((p) => p.isAlive).map((p) => p.playerId);
  const votes = state.day.votes;
  const mayor = state.players.find((p) => p.isMayor && p.isAlive);
  const count = {};
  for (const id of candidates) count[id] = 0;
  for (const voterId of Object.keys(votes)) {
    const targetId = votes[voterId];
    if (candidates.includes(targetId)) count[targetId] = (count[targetId] || 0) + 1;
  }
  const maxVotes = Math.max(...Object.values(count), 0);
  const winners = Object.entries(count)
    .filter(([, v]) => v === maxVotes)
    .map(([id]) => id);

  if (winners.length === 0) return { eliminatedId: null, tie: false };
  if (winners.length === 1) return { eliminatedId: winners[0], tie: false };

  // Gleichstand: zuerst Stichwahl
  if (!state.day.runoffCandidates) {
    return { eliminatedId: null, tie: true, runoff: winners };
  }
  // Stichwahl-Gleichstand: Bürgermeister-Stimme zählt doppelt (nur hier)
  if (mayor) {
    const mayorVote = votes[mayor.playerId];
    if (mayorVote && winners.includes(mayorVote)) count[mayorVote] += 1;
    const minVotes = Math.min(...winners.map((id) => count[id]));
    const eliminated = winners.find((id) => count[id] === minVotes);
    if (eliminated) return { eliminatedId: eliminated, tie: false };
  }
  // Kein Bürgermeister oder hat nicht unter Kandidaten gewählt → Bürgermeisterwahl nötig (oder Zufall bei deaktiviert)
  return { eliminatedId: null, tie: true, needMayorElection: !mayor, tiedWinnerIds: winners };
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
      candidateIds: state.players.filter((p) => p.isAlive).map((p) => p.playerId),
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
    const eliminated = findPlayer(eliminatedId);
    if (eliminated?.isAlive) {
      eliminated.isAlive = false;
      state.day.eliminatedId = eliminatedId;
      addGameLog(state.round, "day", "lynch", eliminated.name);
    }
    state.day.status = "decided";
    state.day.tieResolution = "random";
    state.day.runoffCandidates = null;
    schedulePersist();
    return { ok: true, decided: true, eliminatedId };
  }

  if (result.eliminatedId) {
    const eliminated = findPlayer(result.eliminatedId);
    if (eliminated?.isAlive) {
      eliminated.isAlive = false;
      state.day.eliminatedId = result.eliminatedId;
      addGameLog(state.round, "day", "lynch", eliminated.name);

      // Check Kopfgeldjäger win condition immediately upon day vote death
      const kopfgeldjaeger = state.players.find(p => p.role === "kopfgeldjaeger");
      if (kopfgeldjaeger && kopfgeldjaeger.isAlive && state.day.votes[kopfgeldjaeger.playerId] === eliminated.playerId) {
        state.phase = "game_end";
        state.winner = "kopfgeldjaeger";
        schedulePersist();
        return { ok: true, decided: true, eliminatedId: result.eliminatedId, winner: "kopfgeldjaeger" };
      }
    }
  }

  state.day.status = "decided";
  state.day.tieResolution = result.tie ? "mayor_decides" : null;
  schedulePersist();
  return { ok: true, decided: true, eliminatedId: result.eliminatedId };
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
  state.night = {
    round: state.round,
    subPhase: "werwolf",
    actions: { werwolf: { targetId: null }, seher: { targetId: null }, hexe: { healId: null, poisonId: null } },
    victimId: null,
  };
  state.day = null;
  schedulePersist();
  return { ok: true, phase: "night", round: state.round };
}

/**
 * Siegbedingungen: Werwölfe (alle anderen tot oder Gleichzahl), Dorf (keine Werwölfe mehr), Kopfgeldjäger (Ziel tot), Liebespaar (nur sie beide leben).
 */
function checkWinCondition() {
  const alive = state.players.filter((p) => p.isAlive);
  
  // Kopfgeldjäger-Sieg: Wenn das Spiel aus ist (z.B. Dorf oder Wölfe würden gewinnen) 
  // ODER wenn der Kopfgeldjäger allein mit seinem Ziel lebt etc.
  // Eigentlich triggert der Kopfgeldjäger-Sieg oft im Day-Phase-Resolve, wenn sein Ziel stirbt.
  // Hier ein genereller Check:
  const kopfgeldjaeger = alive.find(p => p.role === "kopfgeldjaeger");
  const kopfgeldTarget = state.players.find(p => p.kopfgeldTarget); // Wenn wir ein Target gesetzt haben

  const werewolves = alive.filter((p) => p.role === "werwolf");
  const others = alive.filter((p) => p.role !== "werwolf");
  
  // Liebespaar-Sieg
  if (alive.length === 2) {
    const isLover1 = alive[0].inLove;
    const isLover2 = alive[1].inLove;
    if (isLover1 && isLover2) return "lovers";
  }

  if (werewolves.length === 0) return "village";
  if (werewolves.length >= others.length) return "werwolf";
  return null;
}

/**
 * Spieler aus Raum entfernen (z. B. nach Ban).
 */
export function removePlayer(playerId) {
  const idx = state.players.findIndex((p) => p.playerId === playerId);
  if (idx === -1) return;
  state.players.splice(idx, 1);
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
}

/**
 * CLI/Server: Spiel sofort beenden.
 */
export function endGameNow(winner = "village") {
  state.phase = "game_end";
  state.winner = winner;
  schedulePersist();
}
