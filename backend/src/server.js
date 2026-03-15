/**
 * Werwolf Jugend – Backend
 * Ein aktiver Spielraum, Echtzeit über Socket.io.
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { PLAYER_PASSWORD, ADMIN_PASSWORD } from "./constants.js";
import {
  getState,
  getPlayerIdBySocket,
  setSocketPlayer,
  removeSocketPlayer,
  isBanned,
  addBan,
  addPlayer,
  ensureHost,
  setPlayerConnected,
  setPlayerDisconnected,
  isJoinLocked,
  findPlayer,
  findPlayerByReconnect,
  setPlayerName,
  adminSetPlayerName,
  adminLockName,
  adminBan,
  adminSetHost,
  adminSetRules,
  startGame,
  submitMayorVote,
  finishMayorElection,
  submitNightAction,
  advanceNightPhase,
  submitDayVote,
  submitDayAccusation,
  resolveDayPhase,
  submitJaegerKill,
  advanceFromResult,
  hostSetMayor,
  hostSkipPhase,
  removePlayer,
  generateReconnectToken,
  removeBan,
  hostKick,
  getStateForPersistence,
  getBansForPersistence,
  forceUnban,
  resetState,
  resetToLobbyAfterGameEnd,
  endGameNow,
} from "./game-state.js";
import * as persistence from "./persistence.js";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*" },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "werwolf-jugend" });
});

/** Broadcast State an alle im Raum (optional nur an einen Socket). */
function broadcastState(socketId = null) {
  if (socketId) {
    const playerId = getPlayerIdBySocket(socketId);
    const forViewer = getState(playerId);
    io.to(socketId).emit("state", forViewer);
  } else {
    // Send customized state to each connected socket
    io.sockets.sockets.forEach((s) => {
      const playerId = getPlayerIdBySocket(s.id);
      const forViewer = getState(playerId);
      s.emit("state", forViewer);
    });
  }
}

/** Alle verbundenen Sockets im Raum benachrichtigen. */
function broadcast(event, data) {
  io.emit(event, data);
}

io.on("connection", (socket) => {
  const ip =
    socket.handshake.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    socket.handshake.address;

  socket.on("join", (payload, ack) => {
    const {
      playerName,
      password,
      reconnectToken,
      playerId: clientPlayerId,
      fingerprint,
    } = payload || {};

    const sendError = (code, message) => {
      socket.emit("join_error", { code, message });
      if (typeof ack === "function") ack({ ok: false, code, message });
    };

    if (getState(null).phase === "game_end") {
      resetToLobbyAfterGameEnd();
    }

    if (isBanned({ playerId: clientPlayerId, fingerprint, ip })) {
      sendError("banned", "Du bist von diesem Raum ausgeschlossen.");
      return;
    }

    const isReconnect =
      clientPlayerId && reconnectToken && findPlayerByReconnect(clientPlayerId, reconnectToken);

    if (isJoinLocked() && !isReconnect) {
      sendError("game_started", "Das Spiel hat bereits begonnen. Beitritt nicht mehr möglich.");
      return;
    }

    if (isReconnect) {
      const player = findPlayer(clientPlayerId);
      player.isConnected = true;
      player.lastSeenAt = new Date().toISOString();
      if (playerName && player.name !== playerName) {
        if (player.canChangeName) player.name = String(playerName).trim().slice(0, 80) || player.name;
      }
      setSocketPlayer(socket.id, player.playerId);
      socket.emit("joined", {
        playerId: player.playerId,
        reconnectToken: player.reconnectToken,
        canChangeName: player.canChangeName,
        isAdmin: player.isAdmin,
        isHost: player.isHost,
      });
      io.emit("state", getState(null));
      io.to(socket.id).emit("state", getState(player.playerId));
      if (typeof ack === "function") ack({ ok: true, rejoin: true });
      return;
    }

    if (!playerName || typeof playerName !== "string") {
      sendError("invalid_name", "Bitte gib einen Namen ein.");
      return;
    }

    const trimmedName = playerName.trim().slice(0, 80) || "Spieler";
    const isAdmin = password === ADMIN_PASSWORD;
    if (password !== PLAYER_PASSWORD && !isAdmin) {
      sendError("wrong_password", "Falsches Passwort.");
      return;
    }

    // Wenn der Spieler sich komplett neu einloggt, aber schon existiert (Gleicher Name, Name Lock)
    const stateSnapshot = getState(null);
    const existingPlayer = stateSnapshot.players.find(
      (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
    );

    let finalPlayerId;

    if (existingPlayer) {
      // Existierender Spieler reconnectet (ohne Token, z.B. nach "Runde verlassen")
      finalPlayerId = existingPlayer.playerId;
      existingPlayer.isConnected = true;
      existingPlayer.lastSeenAt = new Date().toISOString();
      setSocketPlayer(socket.id, existingPlayer.playerId);

      socket.emit("joined", {
        playerId: existingPlayer.playerId,
        reconnectToken: existingPlayer.reconnectToken,
        canChangeName: existingPlayer.canChangeName,
        isAdmin: existingPlayer.isAdmin,
        isHost: existingPlayer.isHost,
      });

      io.emit("state", getState(null));
      io.to(socket.id).emit("state", getState(existingPlayer.playerId));
      if (typeof ack === "function") ack({ ok: true });
      return;
    }

    if (isJoinLocked()) {
      sendError("game_started", "Das Spiel hat bereits begonnen. Beitritt nicht mehr möglich.");
      return;
    }

    const newPlayer = {
      playerId: randomUUID(),
      name: trimmedName,
      isAdmin,
      reconnectToken: randomUUID(),
    };

    const result = addPlayer({
      playerId: newPlayer.playerId,
      name: newPlayer.name,
      isAdmin: newPlayer.isAdmin,
      isHost: false,
      reconnectToken: newPlayer.reconnectToken,
      fingerprint,
      ip,
    });

    if (!result.ok) {
      if (result.error === "game_started") sendError("game_started", "Das Spiel hat bereits begonnen.");
      else if (result.error === "room_full") sendError("room_full", "Der Raum ist voll.");
      else sendError("error", result.error || "Beitritt fehlgeschlagen.");
      return;
    }

    ensureHost();
    setSocketPlayer(socket.id, result.player.playerId);

    socket.emit("joined", {
      playerId: result.player.playerId,
      reconnectToken: result.player.reconnectToken,
      canChangeName: result.player.canChangeName,
      isAdmin: result.player.isAdmin,
      isHost: result.player.isHost,
    });
    broadcastState();
    broadcast("player_joined", {
      player: getState(null).players.find((p) => p.playerId === result.player.playerId),
    });

    if (typeof ack === "function") ack({ ok: true, rejoin: false });
  });

  socket.on("set_name", (payload) => {
    const playerId = getPlayerIdBySocket(socket.id);
    if (!playerId) return;
    const result = setPlayerName(playerId, payload?.newName);
    if (!result.ok) {
      socket.emit("error", { code: result.error, message: "Namensänderung nicht möglich." });
      return;
    }
    broadcast("player_updated", { playerId, updates: { name: result.name } });
    broadcastState();
  });

  socket.on("start_game", () => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = startGame(playerId);
    if (!result.ok) {
      socket.emit("error", {
        code: result.error,
        message:
          result.error === "not_host"
            ? "Nur der Host kann das Spiel starten."
            : result.error === "not_enough_players"
              ? "Nicht genug Spieler."
              : "Spiel konnte nicht gestartet werden.",
      });
      return;
    }
    const snap = getState(null);
    broadcast("phase_changed", { phase: snap.phase, round: snap.round ?? 1 });
    broadcastState();
  });

  socket.on("mayor_vote", (payload) => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = submitMayorVote(playerId, payload?.targetPlayerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "invalid_vote", message: "Stimme ungültig." });
      return;
    }
    broadcastState();
  });

  socket.on("mayor_phase_next", () => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = finishMayorElection(playerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "invalid", message: "Aktion nicht möglich." });
      return;
    }
    if (result.mayorId) {
      const mayor = findPlayer(result.mayorId);
      broadcast("mayor_result", { mayorId: result.mayorId, mayorName: mayor?.name });
    }
    broadcast("phase_changed", { phase: result.backToDay ? "day" : "night", round: 1 });
    broadcastState();
  });

  socket.on("night_action", (payload) => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = submitNightAction(playerId, payload);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "no_action", message: "Nachtaktion ungültig." });
      return;
    }
    broadcastState();
  });

  socket.on("day_accuse", (payload) => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = submitDayAccusation(playerId, payload?.targetPlayerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "invalid", message: "Anklage ungültig." });
      return;
    }
    broadcastState();
  });

  socket.on("day_vote", (payload) => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = submitDayVote(playerId, payload?.targetPlayerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "invalid_vote", message: "Stimme ungültig." });
      return;
    }
    broadcastState();
  });

  socket.on("jaeger_kill", (payload) => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = submitJaegerKill(playerId, payload?.targetId ?? payload?.targetPlayerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Jäger-Schuss nicht möglich." });
      return;
    }
    if (result.phase) broadcast("phase_changed", { phase: result.phase });
    broadcastState();
  });

  socket.on("phase_next", () => {
    const playerId = getPlayerIdBySocket(socket.id);
    const stateSnapshot = getState(null);
    let result;
    if (stateSnapshot.phase === "night") {
      result = advanceNightPhase(playerId);
      if (result.ok && result.phase === "day" && result.victimId) {
        const victim = findPlayer(result.victimId);
        broadcast("night_victim", { victimId: result.victimId, victimName: victim?.name });
      }
    } else if (stateSnapshot.phase === "day") {
      result = resolveDayPhase(playerId);
      if (result.ok && result.eliminatedId) {
        const eliminated = findPlayer(result.eliminatedId);
        broadcast("vote_result", { eliminatedId: result.eliminatedId, eliminatedName: eliminated?.name });
      }
      if (result.ok && result.runoff) broadcast("vote_result", { runoff: true });
      if (result.ok && result.needMayorElection)
        broadcast("phase_changed", { phase: "mayor_election", round: stateSnapshot.round });
    } else if (stateSnapshot.phase === "result") {
      result = advanceFromResult(playerId);
      if (result.ok && result.winner) broadcast("game_end", { winner: result.winner });
    } else {
      socket.emit("error", { code: "invalid_phase", message: "Phasenwechsel hier nicht möglich." });
      return;
    }
    if (!result.ok) {
      socket.emit("error", { code: result.error || "invalid", message: "Aktion nicht möglich." });
      return;
    }
    if (result.phase) broadcast("phase_changed", { phase: result.phase, round: result.round ?? stateSnapshot.round });
    broadcastState();
  });

  socket.on("admin_change_name", (payload) => {
    const adminId = getPlayerIdBySocket(socket.id);
    const result = adminSetPlayerName(adminId, payload?.targetPlayerId, payload?.newName);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Aktion nicht erlaubt." });
      return;
    }
    broadcast("player_updated", {
      playerId: payload.targetPlayerId,
      updates: { name: result.name },
    });
    broadcastState();
  });

  socket.on("admin_lock_name", (payload) => {
    const adminId = getPlayerIdBySocket(socket.id);
    const result = adminLockName(adminId, payload?.targetPlayerId, payload?.lock !== false);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Aktion nicht erlaubt." });
      return;
    }
    broadcast("player_updated", {
      playerId: payload.targetPlayerId,
      updates: { canChangeName: result.canChangeName },
    });
    broadcastState();
  });

  socket.on("admin_ban", (payload) => {
    const adminId = getPlayerIdBySocket(socket.id);
    const result = adminBan(adminId, {
      targetPlayerId: payload?.targetPlayerId,
      fingerprint: payload?.fingerprint,
      ip: payload?.ip,
    });
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Ban fehlgeschlagen." });
      return;
    }
    const targetId = payload?.targetPlayerId;
    broadcast("player_banned", { playerId: targetId });
    const targetSockets = [];
    io.sockets.sockets.forEach((s, id) => {
      if (getPlayerIdBySocket(id) === targetId) targetSockets.push(s);
    });
    targetSockets.forEach((s) => {
      s.emit("join_error", { code: "banned", message: "Du wurdest aus dem Raum ausgewiesen." });
      s.disconnect(true);
    });
    removePlayer(targetId);
    broadcastState();
  });

  socket.on("admin_unban", (payload) => {
    const adminId = getPlayerIdBySocket(socket.id);
    const result = removeBan(adminId, payload?.targetPlayerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Entbannen fehlgeschlagen." });
      return;
    }
    broadcastState();
  });

  socket.on("host_kick", (payload) => {
    const actorId = getPlayerIdBySocket(socket.id);
    const result = hostKick(actorId, payload?.targetPlayerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Kicken fehlgeschlagen." });
      return;
    }
    const targetId = payload?.targetPlayerId;
    broadcast("player_left", { playerId: targetId });
    const targetSockets = [];
    io.sockets.sockets.forEach((s, id) => {
      if (getPlayerIdBySocket(id) === targetId) targetSockets.push(s);
    });
    targetSockets.forEach((s) => {
      s.emit("join_error", { code: "kicked", message: "Du wurdest aus dem Raum entfernt." });
      s.disconnect(true);
    });
    broadcastState();
  });

  socket.on("admin_set_host", (payload) => {
    const adminId = getPlayerIdBySocket(socket.id);
    const result = adminSetHost(adminId, payload?.targetPlayerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Host-Wechsel fehlgeschlagen." });
      return;
    }
    broadcastState();
  });

  socket.on("host_set_mayor", (payload) => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = hostSetMayor(playerId, payload?.mayorPlayerId ?? null);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Aktion nicht möglich." });
      return;
    }
    if (result.mayorId) {
      const mayor = findPlayer(result.mayorId);
      broadcast("mayor_result", { mayorId: result.mayorId, mayorName: mayor?.name });
    }
    if (result.phase) broadcast("phase_changed", { phase: result.phase, round: getState(null).round ?? 1 });
    broadcastState();
  });

  socket.on("host_skip_phase", () => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = hostSkipPhase(playerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Phase überspringen nicht möglich." });
      return;
    }
    if (result.victimId) {
      const victim = findPlayer(result.victimId);
      broadcast("night_victim", { victimId: result.victimId, victimName: victim?.name });
    }
    if (result.phase) broadcast("phase_changed", { phase: result.phase, round: result.round ?? getState(null).round });
    broadcastState();
  });

  socket.on("admin_set_rules", (payload) => {
    const adminId = getPlayerIdBySocket(socket.id);
    const result = adminSetRules(adminId, payload?.rules);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Regeln konnten nicht gesetzt werden." });
      return;
    }
    broadcastState();
  });

  socket.on("disconnect", (reason) => {
    const playerId = getPlayerIdBySocket(socket.id);
    if (playerId) {
      const p = findPlayer(playerId);
      setPlayerDisconnected(playerId);
      removeSocketPlayer(socket.id);
      
      // If we are still in lobby, simply remove the player completely
      if (!isJoinLocked()) {
        removePlayer(playerId);
      }
      
      broadcast("player_left", { playerId });
      broadcastState();
    }
  });
});

// Beim Neustart: kein Spielstand laden – immer mit leerer Lobby starten

const PORT = Number(process.env.PORT) || 3000;
httpServer.listen(PORT, () => {
  console.log(`Werwolf Jugend Backend läuft auf http://localhost:${PORT}`);
  startCli().catch((e) => console.warn("CLI:", e.message));
});

/** Einfache CLI: Befehle über stdin (ban, unban, kick, end, list, state, help). */
async function startCli() {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const help = `
CLI-Befehle (Enter zum Ausführen):
  list              – Spieler auflisten (Name, Id, Host, lebend)
  state             – Phase und Runde anzeigen
  kick <playerId>   – Spieler aus Raum entfernen (ohne Bann)
  ban <playerId>   – Spieler bannen (Server-Admin)
  unban <playerId> – Bann aufheben
  end               – Spiel sofort beenden
  reset             – State zurücksetzen (Lobby, keine Spieler)
  help              – diese Hilfe
`;

  rl.on("line", (line) => {
    const parts = line.trim().split(/\s+/);
    const cmd = (parts[0] || "").toLowerCase();
    const arg = parts[1];

    if (cmd === "help") {
      console.log(help);
      return;
    }
    if (cmd === "list") {
      const s = getState(null);
      s.players.forEach((p) => console.log(`  ${p.playerId.slice(0, 8)}… ${p.name} ${p.isHost ? " [Host]" : ""} ${p.isAlive === false ? " [tot]" : ""}`));
      return;
    }
    if (cmd === "state") {
      const s = getState(null);
      console.log(`  Phase: ${s.phase}, Runde: ${s.round}, Spieler: ${s.players.length}`);
      return;
    }
    if (cmd === "kick" && arg) {
      const s = getState(null);
      const actor = s.players[0]?.playerId;
      if (!actor) {
        console.log("  Kein Spieler im Raum – Kick nicht möglich (nutze reset).");
        return;
      }
      const result = hostKick(actor, arg);
      if (result.ok) {
        console.log("  Spieler gekickt.");
      } else {
        console.log("  Fehler:", result.error);
      }
      return;
    }
    if (cmd === "ban" && arg) {
      addBan({ playerId: arg });
      removePlayer(arg);
      persistence.saveSync({ state: getStateForPersistence(), bans: getBansForPersistence() });
      console.log("  Spieler gebannt.");
      return;
    }
    if (cmd === "unban" && arg) {
      forceUnban(arg);
      persistence.saveSync({ state: getStateForPersistence(), bans: getBansForPersistence() });
      console.log("  Bann aufgehoben.");
      return;
    }
    if (cmd === "end") {
      endGameNow("village");
      persistence.saveSync({ state: getStateForPersistence(), bans: getBansForPersistence() });
      console.log("  Spiel beendet.");
      return;
    }
    if (cmd === "reset") {
      resetState();
      persistence.saveSync({ state: getStateForPersistence(), bans: getBansForPersistence() });
      console.log("  State zurückgesetzt.");
      return;
    }
    if (cmd) console.log('  Unbekannter Befehl. "help" für Hilfe.');
  });
}
