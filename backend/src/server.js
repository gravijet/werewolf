/**
 * Werwolf – Backend
 * Ein aktiver Spielraum, Echtzeit über Socket.io.
 */

import "dotenv/config";
import { randomUUID, timingSafeEqual } from "crypto";
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
  restartToLobby,
  endGameNow,
} from "./game-state.js";
import * as persistence from "./persistence.js";

const app = express();
const httpServer = createServer(app);

app.disable("x-powered-by");

/**
 * Konstantzeit-Vergleich für Passwörter (verhindert Timing-Angriffe).
 * Gibt bei ungleicher Länge sofort false zurück, hält aber die Vergleichszeit stabil.
 */
function passwordsMatch(a, b) {
  const aBuf = Buffer.from(String(a ?? ""), "utf8");
  const bBuf = Buffer.from(String(b ?? ""), "utf8");
  if (aBuf.length !== bBuf.length) {
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

// CORS-Origins kommagetrennt aus Umgebung; sonst Origin der Anfrage spiegeln (Dev).
const corsOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1 MB – schützt vor übergroßen Payloads
});

app.use(express.json({ limit: "64kb" }));

// Defensive Security-Header (nginx setzt in Produktion zusätzlich eigene).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.get("/health", (req, res) => {
  const snap = getState(null);
  res.json({
    ok: true,
    service: "werwolf-service",
    phase: snap.phase,
    players: snap.players.length,
    uptime: Math.round(process.uptime()),
  });
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

/** Einfacher Sliding-Window-Rate-Limiter pro Verbindung. */
function makeLimiter() {
  const buckets = new Map();
  return (key, max, windowMs) => {
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count += 1;
    return b.count <= max;
  };
}

io.on("connection", (socket) => {
  const ip =
    socket.handshake.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    socket.handshake.address;

  const allow = makeLimiter();

  /**
   * Registriert einen Event-Handler mit Rate-Limiting und Fehler-Kapselung.
   * So bringt ein einzelner Fehler oder Event-Spam den Server nicht durcheinander.
   */
  const safeOn = (event, handler, { max = 60, windowMs = 10000 } = {}) => {
    socket.on(event, (...args) => {
      const maybeAck = args[args.length - 1];
      const ack = typeof maybeAck === "function" ? maybeAck : null;
      if (!allow(event, max, windowMs)) {
        socket.emit("error", { code: "rate_limited", message: "Zu viele Anfragen. Bitte kurz warten." });
        if (ack) {
          try { ack({ ok: false, code: "rate_limited" }); } catch {}
        }
        return;
      }
      try {
        handler(...args);
      } catch (e) {
        console.error(`[socket:${event}]`, e);
        socket.emit("error", { code: "server_error", message: "Etwas ist schiefgelaufen." });
        if (ack) {
          try { ack({ ok: false, code: "server_error" }); } catch {}
        }
      }
    });
  };

  safeOn(
    "join",
    (payload, ack) => {
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
        sendError("banned", "Du bist für diesen Raum gesperrt.");
        return;
      }

      const isReconnect =
        clientPlayerId && reconnectToken && findPlayerByReconnect(clientPlayerId, reconnectToken);

      if (isJoinLocked() && !isReconnect) {
        sendError("game_started", "Die Runde läuft bereits.");
        return;
      }

      if (isReconnect) {
        const player = findPlayer(clientPlayerId);
        player.isConnected = true;
        player.lastSeenAt = new Date().toISOString();
        player.ip = ip;
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
        broadcastState();
        if (typeof ack === "function") ack({ ok: true, rejoin: true });
        return;
      }

      if (!playerName || typeof playerName !== "string") {
        sendError("invalid_name", "Bitte gib einen Namen an.");
        return;
      }

      const trimmedName = playerName.trim().slice(0, 80) || "Unbekannt";
      const isAdmin = passwordsMatch(password, ADMIN_PASSWORD);
      if (!passwordsMatch(password, PLAYER_PASSWORD) && !isAdmin) {
        sendError("wrong_password", "Das Passwort ist nicht korrekt.");
        return;
      }

      // Namens-Kollisionen dürfen nicht als Reconnect behandelt werden.
      // Reconnect ist ausschließlich über playerId + reconnectToken erlaubt.
      const stateSnapshot = getState(null);
      const existingPlayerMasked = stateSnapshot.players.find(
        (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (existingPlayerMasked) {
        const existingPlayer = findPlayer(existingPlayerMasked.playerId);
        if (existingPlayer) {
          sendError("name_taken", "Dieser Name ist schon vergeben.");
          return;
        }
      }

      if (isJoinLocked()) {
        sendError("game_started", "Diese Runde läuft bereits. Ein Beitritt ist nicht mehr möglich.");
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
        if (result.error === "game_started") sendError("game_started", "Die Runde läuft bereits.");
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
    },
    { max: 20, windowMs: 30000 }
  );

  safeOn("set_name", (payload) => {
    const playerId = getPlayerIdBySocket(socket.id);
    if (!playerId) return;
    const result = setPlayerName(playerId, payload?.newName);
    if (!result.ok) {
      socket.emit("error", { code: result.error, message: "Der Name kann gerade nicht geändert werden." });
      return;
    }
    broadcast("player_updated", { playerId, updates: { name: result.name } });
    broadcastState();
  });

  safeOn("start_game", () => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = startGame(playerId);
    if (!result.ok) {
      socket.emit("error", {
        code: result.error,
        message:
          result.error === "not_host"
            ? "Nur der Host darf die Runde starten."
            : result.error === "not_enough_players"
              ? "Es sind noch nicht genug Spieler im Raum."
              : "Die Runde konnte nicht gestartet werden.",
      });
      return;
    }
    const snap = getState(null);
    broadcast("phase_changed", { phase: snap.phase, round: snap.round ?? 1 });
    broadcastState();
  });

  safeOn("restart_game", () => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = restartToLobby(playerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Neue Runde nicht möglich." });
      return;
    }
    broadcast("phase_changed", { phase: "lobby", round: 0 });
    broadcastState();
  });

  safeOn("mayor_vote", (payload) => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = submitMayorVote(playerId, payload?.targetPlayerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "invalid_vote", message: "Diese Stimme ist ungültig." });
      return;
    }
    broadcastState();
  });

  safeOn("mayor_phase_next", () => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = finishMayorElection(playerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "invalid", message: "Diese Aktion ist nicht möglich." });
      return;
    }
    if (result.mayorId) {
      const mayor = findPlayer(result.mayorId);
      broadcast("mayor_result", { mayorId: result.mayorId, mayorName: mayor?.name });
    }
    broadcast("phase_changed", { phase: result.backToDay ? "day" : "night", round: getState(null).round ?? 1 });
    broadcastState();
  });

  safeOn("night_action", (payload) => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = submitNightAction(playerId, payload);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "no_action", message: "Diese Nachtaktion ist ungültig." });
      return;
    }
    broadcastState();
  });

  safeOn("day_accuse", (payload) => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = submitDayAccusation(playerId, payload?.targetPlayerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "invalid", message: "Diese Anklage ist ungültig." });
      return;
    }
    broadcastState();
  });

  safeOn("day_vote", (payload) => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = submitDayVote(playerId, payload?.targetPlayerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "invalid_vote", message: "Diese Stimme ist ungültig." });
      return;
    }
    broadcastState();
  });

  safeOn("jaeger_kill", (payload) => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = submitJaegerKill(playerId, payload?.targetId ?? payload?.targetPlayerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Der Schuss des Jägers ist jetzt nicht möglich." });
      return;
    }
    if (result.winner) broadcast("game_end", { winner: result.winner });
    if (result.phase) broadcast("phase_changed", { phase: result.phase });
    broadcastState();
  });

  safeOn("phase_next", () => {
    const playerId = getPlayerIdBySocket(socket.id);
    const stateSnapshot = getState(null);
    let result;
    if (stateSnapshot.phase === "night") {
      result = advanceNightPhase(playerId);
      if (result.ok && result.phase === "day" && result.victimId) {
        const victim = findPlayer(result.victimId);
        broadcast("night_victim", { victimId: result.victimId, victimName: victim?.name });
      }
      if (result.ok && result.winner) broadcast("game_end", { winner: result.winner });
    } else if (stateSnapshot.phase === "day") {
      result = resolveDayPhase(playerId);
      if (result.ok && result.eliminatedId) {
        const eliminated = findPlayer(result.eliminatedId);
        broadcast("vote_result", { eliminatedId: result.eliminatedId, eliminatedName: eliminated?.name });
      }
      if (result.ok && result.runoff) broadcast("vote_result", { runoff: true });
      if (result.ok && result.needMayorElection)
        broadcast("phase_changed", { phase: "mayor_election", round: stateSnapshot.round });
      if (result.ok && result.winner) broadcast("game_end", { winner: result.winner });
    } else if (stateSnapshot.phase === "result") {
      result = advanceFromResult(playerId);
      if (result.ok && result.winner) broadcast("game_end", { winner: result.winner });
    } else {
      socket.emit("error", { code: "invalid_phase", message: "Hier ist kein Phasenwechsel möglich." });
      return;
    }
    if (!result.ok) {
      socket.emit("error", { code: result.error || "invalid", message: "Diese Aktion ist nicht möglich." });
      return;
    }
    if (result.phase) broadcast("phase_changed", { phase: result.phase, round: result.round ?? stateSnapshot.round });
    broadcastState();
  });

  safeOn("admin_change_name", (payload) => {
    const adminId = getPlayerIdBySocket(socket.id);
    const result = adminSetPlayerName(adminId, payload?.targetPlayerId, payload?.newName);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Du hast dafür keine Berechtigung." });
      return;
    }
    broadcast("player_updated", {
      playerId: payload.targetPlayerId,
      updates: { name: result.name },
    });
    broadcastState();
  });

  safeOn("admin_lock_name", (payload) => {
    const adminId = getPlayerIdBySocket(socket.id);
    const result = adminLockName(adminId, payload?.targetPlayerId, payload?.lock !== false);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Du hast dafür keine Berechtigung." });
      return;
    }
    broadcast("player_updated", {
      playerId: payload.targetPlayerId,
      updates: { canChangeName: result.canChangeName },
    });
    broadcastState();
  });

  safeOn("admin_ban", (payload) => {
    const adminId = getPlayerIdBySocket(socket.id);
    const result = adminBan(adminId, {
      targetPlayerId: payload?.targetPlayerId,
    });
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Spieler konnte nicht gesperrt werden." });
      return;
    }
    const targetId = payload?.targetPlayerId;
    broadcast("player_banned", { playerId: targetId });
    const targetSockets = [];
    io.sockets.sockets.forEach((s, id) => {
      if (getPlayerIdBySocket(id) === targetId) targetSockets.push(s);
    });
    targetSockets.forEach((s) => {
      s.emit("join_error", { code: "banned", message: "Du wurdest aus diesem Raum verbannt." });
      s.disconnect(true);
    });
    removePlayer(targetId);
    broadcastState();
  });

  safeOn("admin_unban", (payload) => {
    const adminId = getPlayerIdBySocket(socket.id);
    const result = removeBan(adminId, payload?.targetPlayerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Sperre konnte nicht aufgehoben werden." });
      return;
    }
    broadcastState();
  });

  safeOn("host_kick", (payload) => {
    const actorId = getPlayerIdBySocket(socket.id);
    const result = hostKick(actorId, payload?.targetPlayerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Spieler konnte nicht entfernt werden." });
      return;
    }
    const targetId = payload?.targetPlayerId;
    broadcast("player_left", { playerId: targetId });
    const targetSockets = [];
    io.sockets.sockets.forEach((s, id) => {
      if (getPlayerIdBySocket(id) === targetId) targetSockets.push(s);
    });
    targetSockets.forEach((s) => {
      s.emit("join_error", { code: "kicked", message: "Du wurdest aus dieser Runde entfernt." });
      s.disconnect(true);
    });
    broadcastState();
  });

  safeOn("admin_set_host", (payload) => {
    const adminId = getPlayerIdBySocket(socket.id);
    const result = adminSetHost(adminId, payload?.targetPlayerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Host-Wechsel fehlgeschlagen." });
      return;
    }
    broadcastState();
  });

  safeOn("host_set_mayor", (payload) => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = hostSetMayor(playerId, payload?.mayorPlayerId ?? null);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Diese Aktion ist nicht möglich." });
      return;
    }
    if (result.mayorId) {
      const mayor = findPlayer(result.mayorId);
      broadcast("mayor_result", { mayorId: result.mayorId, mayorName: mayor?.name });
    }
    if (result.phase) broadcast("phase_changed", { phase: result.phase, round: getState(null).round ?? 1 });
    broadcastState();
  });

  safeOn("host_skip_phase", () => {
    const playerId = getPlayerIdBySocket(socket.id);
    const result = hostSkipPhase(playerId);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Phase kann hier nicht übersprungen werden." });
      return;
    }
    if (result.victimId) {
      const victim = findPlayer(result.victimId);
      broadcast("night_victim", { victimId: result.victimId, victimName: victim?.name });
    }
    if (result.phase) broadcast("phase_changed", { phase: result.phase, round: result.round ?? getState(null).round });
    broadcastState();
  });

  safeOn("admin_set_rules", (payload) => {
    const adminId = getPlayerIdBySocket(socket.id);
    const result = adminSetRules(adminId, payload?.rules);
    if (!result.ok) {
      socket.emit("error", { code: result.error || "forbidden", message: "Die Regeln konnten nicht übernommen werden." });
      return;
    }
    broadcastState();
  });

  socket.on("disconnect", (reason) => {
    try {
      const playerId = getPlayerIdBySocket(socket.id);
      if (playerId) {
        setPlayerDisconnected(playerId);
        removeSocketPlayer(socket.id);

        // In der Lobby: Spieler vollständig entfernen.
        if (!isJoinLocked()) {
          removePlayer(playerId);
        }

        broadcast("player_left", { playerId });
        broadcastState();
      }
    } catch (e) {
      console.error("[socket:disconnect]", e);
    }
  });
});

// Beim Neustart: kein Spielstand laden – immer mit leerer Lobby starten.

const PORT = Number(process.env.PORT) || 3000;
httpServer.listen(PORT, () => {
  console.log(`Werwolf Backend läuft auf http://localhost:${PORT}`);
  startCli().catch((e) => console.warn("CLI:", e.message));
});

// Graceful Shutdown (z. B. unter pm2/systemd).
function shutdown(signal) {
  console.log(`\n${signal} empfangen – Server wird beendet …`);
  try {
    persistence.saveSync({ state: getStateForPersistence(), bans: getBansForPersistence() });
  } catch {}
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
  // Notausstieg, falls Verbindungen hängen.
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => console.error("unhandledRejection:", reason));
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));

/** Einfache CLI: Befehle über stdin (ban, unban, kick, end, list, state, help). */
async function startCli() {
  if (!process.stdin.isTTY) return; // unter pm2/systemd kein interaktives stdin
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
        broadcastState();
      } else {
        console.log("  Fehler:", result.error);
      }
      return;
    }
    if (cmd === "ban" && arg) {
      addBan({ playerId: arg });
      removePlayer(arg);
      persistence.saveSync({ state: getStateForPersistence(), bans: getBansForPersistence() });
      broadcastState();
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
      broadcastState();
      console.log("  Spiel beendet.");
      return;
    }
    if (cmd === "reset") {
      resetState();
      persistence.saveSync({ state: getStateForPersistence(), bans: getBansForPersistence() });
      broadcastState();
      console.log("  State zurückgesetzt.");
      return;
    }
    if (cmd) console.log('  Unbekannter Befehl. "help" für Hilfe.');
  });
}
