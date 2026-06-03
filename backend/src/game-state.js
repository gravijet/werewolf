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
        amor: {
          lover1Id: viewer?.role === 'amor' ? rawActions.amor?.lover1Id : null,
          lover2Id: viewer?.role === 'amor' ? rawActions.amor?.lover2Id : null
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
  const isGameEnd = state.phase === "game_end";
  // Am Spielende werden alle Rollen für alle sichtbar (Auflösung).
  const showRole = isViewer || isGameEnd || (isDeadViewer && state.rules?.revealRolesToDead) || isModerator;

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
    const merged = { ...state.rules, ...newRules };
    if (newRules.roles && typeof newRules.roles === "object") {
      const normalizedRoles = {};
      for (const [roleId, roleConfig] of Object.entries(newRules.roles)) {
        const rawCount = roleConfig?.count;
        const normalizedCount =
          rawCount === "1/3" ? "1/3" : Math.max(0, Number.isFinite(Number(rawCount)) ? Number(rawCount) : 0);
        normalizedRoles[roleId] = {
          ...roleConfig,
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

  state.round = 1;
  state.night = null;
  state.day = null;
  state.gameLog = [];
  state.winner = null;
  state.witchUsedHeal = false;
  state.witchUsedPoison = false;

  const n = connectedPlayers.length;
  const roles = distributeRoles(state.rules, n);
  
  connectedPlayers.forEach((p, i) => {
    p.role = roles[i] ?? "dorfbewohner";
    p.isAlive = true;
    p.isMayor = false;
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
  let jaegerKilledId = null;
  const healId = state.night.actions.hexe?.healId;
  const poisonId = state.night.actions.hexe?.poisonId;
  if (healId && victimId === healId) {
    victimId = null;
    state.witchUsedHeal = true;
  }
  if (poisonId) {
    state.witchUsedPoison = true;
    const poisonVictim = findPlayer(poisonId);
    if (poisonVictim?.isAlive) {
      poisonVictim.isAlive = false;
      if (poisonVictim.role === "jaeger") jaegerKilledId = poisonVictim.playerId;
      addGameLog(state.round, "night", "victim_hexe", poisonVictim.name);
      const poisonLoverId = cascadeLover(poisonId, "night");
      if (poisonLoverId && !jaegerKilledId) {
        const poisonLover = findPlayer(poisonLoverId);
        if (poisonLover?.role === "jaeger") jaegerKilledId = poisonLoverId;
      }
    }
  }
  if (victimId) {
    const victim = findPlayer(victimId);
    if (victim?.isAlive) {
      victim.isAlive = false;
      if (victim.role === "jaeger") jaegerKilledId = victim.playerId;
      state.night.victimId = victimId;
      addGameLog(state.round, "night", "victim_werwolf", victim.name);
      const werwolfLoverId = cascadeLover(victimId, "night");
      if (werwolfLoverId && !jaegerKilledId) {
        const werwolfLover = findPlayer(werwolfLoverId);
        if (werwolfLover?.role === "jaeger") jaegerKilledId = werwolfLoverId;
      }
    }
  }

  const nightWinner = checkWinCondition();
  if (nightWinner) {
    state.phase = "game_end";
    state.winner = nightWinner;
    schedulePersist();
    return { ok: true, phase: "game_end", winner: nightWinner };
  }

  // Wenn der Jäger in der Nacht stirbt, darf er direkt danach schießen.
  if (jaegerKilledId) {
    state.jaegerSourceId = jaegerKilledId;
    state.phase = "jaeger_shot";
    schedulePersist();
    return { ok: true, phase: "jaeger_shot", jaegerShot: true, jaegerSourceId: jaegerKilledId };
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
  const p = findPlayer(playerId);
  if (!p || !p.isAlive) return { ok: false, error: "not_allowed" };
  if (p.isHost) return { ok: false, error: "host_does_not_vote" };
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
  if (state.day.status === "voting" && Array.isArray(state.day.accusedIds)) return state.day.accusedIds;
  if (state.day.runoffCandidates && state.day.runoffCandidates.length > 0) return state.day.runoffCandidates;
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
    const targetId = votes[voterId];
    if (targetId && candidates.includes(targetId)) count[targetId] = (count[targetId] || 0) + 1;
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
    const maxVotes = Math.max(...winners.map((id) => count[id]));
    const eliminated = winners.find((id) => count[id] === maxVotes);
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
      const loverId = cascadeLover(eliminatedId, "day");
      if (eliminated.role === "jaeger" || (loverId && findPlayer(loverId)?.role === "jaeger")) {
        const jaegerSourceId = eliminated.role === "jaeger" ? eliminatedId : loverId;
        state.day.status = "decided";
        state.day.tieResolution = "random";
        state.day.runoffCandidates = null;
        state.phase = "jaeger_shot";
        state.jaegerSourceId = jaegerSourceId;
        schedulePersist();
        return { ok: true, phase: "jaeger_shot", jaegerShot: true, eliminatedId };
      }
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

      const kopfgeldjaeger = state.players.find(p => p.role === "kopfgeldjaeger");
      const kopfgeldTargetId = state.day?.accusations?.[kopfgeldjaeger?.playerId];
      if (kopfgeldjaeger && kopfgeldjaeger.isAlive && kopfgeldTargetId === eliminated.playerId) {
        state.phase = "game_end";
        state.winner = "kopfgeldjaeger";
        schedulePersist();
        return { ok: true, decided: true, eliminatedId: result.eliminatedId, winner: "kopfgeldjaeger" };
      }

      const loverId = cascadeLover(result.eliminatedId, "day");

      if (eliminated.role === "jaeger") {
        state.phase = "jaeger_shot";
        state.jaegerSourceId = result.eliminatedId;
        schedulePersist();
        return { ok: true, phase: "jaeger_shot", jaegerShot: true, eliminatedId: result.eliminatedId };
      }
      if (loverId) {
        const lover = findPlayer(loverId);
        if (lover?.role === "jaeger") {
          state.phase = "jaeger_shot";
          state.jaegerSourceId = loverId;
          schedulePersist();
          return { ok: true, phase: "jaeger_shot", jaegerShot: true, eliminatedId: result.eliminatedId };
        }
      }
    }
  }

  const dayWinner = checkWinCondition();
  if (dayWinner) {
    state.day.status = "decided";
    state.phase = "game_end";
    state.winner = dayWinner;
    schedulePersist();
    return { ok: true, decided: true, phase: "game_end", winner: dayWinner };
  }

  state.day.status = "decided";
  state.day.tieResolution = result.tie ? "mayor_decides" : null;
  state.phase = "result";
  schedulePersist();
  return { ok: true, decided: true, phase: "result", eliminatedId: result.eliminatedId };
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

  cascadeLover(targetId, nightCase ? "night" : "day");

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
 * Siegbedingungen: Werwölfe (alle anderen tot oder Gleichzahl), Dorf (keine Werwölfe mehr), Kopfgeldjäger (Ziel tot), Liebespaar (nur sie beide leben).
 */
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
    if (state.night.actions.amor?.lover1Id === playerId) state.night.actions.amor.lover1Id = null;
    if (state.night.actions.amor?.lover2Id === playerId) state.night.actions.amor.lover2Id = null;
  }

  if (state.jaegerSourceId === playerId) state.jaegerSourceId = null;
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
  state.witchUsedHeal = false;
  state.witchUsedPoison = false;
  state.players.forEach((p) => {
    p.role = null;
    p.isAlive = true;
    p.isMayor = false;
    p.inLove = false;
    p.lovePartnerId = null;
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
  state.witchUsedHeal = false;
  state.witchUsedPoison = false;
}

/**
 * CLI/Server: Spiel sofort beenden.
 */
export function endGameNow(winner = "village") {
  state.phase = "game_end";
  state.winner = winner;
  schedulePersist();
}
