import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { getStoredPlayer, setStoredPlayer, clearStoredPlayer, clearStoredCredentials, setLastJoinError, getLastJoinError } from "../lib/storage";

const API_URL = import.meta.env.VITE_API_URL || "";

const GameContext = createContext(null);

/** Einladungs-Token aus dem geteilten Link (/nopassword?t=…) lesen. */
export function getInviteTokenFromUrl() {
  try {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("t") || null;
  } catch {
    return null;
  }
}

export function GameProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState(null);
  const [me, setMe] = useState(null);
  const [joinError, setJoinError] = useState(null);
  const [error, setError] = useState(null);
  const reconnectTimeoutRef = useRef(null);
  const meRef = useRef(null);
  const [reconnectGaveUp, setReconnectGaveUp] = useState(false);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  const connect = useCallback(() => {
    const url = API_URL || (typeof window !== "undefined" ? window.location.origin : "");
    const s = io(url, { path: "/socket.io", transports: ["websocket", "polling"] });
    setSocket(s);

    s.on("connect", () => {
      setConnected(true);
      setReconnectGaveUp(false);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      try {
        const lastErr = getLastJoinError();
        if (lastErr?.code === "kicked" || lastErr?.code === "banned") {
          const stored = getStoredPlayer();
          if (stored) {
            clearStoredCredentials();
            if (stored.playerName) {
              setStoredPlayer({ playerName: stored.playerName });
            }
          }
        }
      } catch {}
      const stored = getStoredPlayer();
      const isNoPassword = typeof window !== "undefined" && window.location.pathname === "/nopassword";
      if (stored?.playerId && stored?.reconnectToken) {
        s.emit("join", {
          playerId: stored.playerId,
          reconnectToken: stored.reconnectToken,
          playerName: stored.playerName,
          password: stored.password,
        });
      } else if (stored?.playerName && stored?.password && !isNoPassword) {
        s.emit("join", { playerName: stored.playerName, password: stored.password });
      } else if (isNoPassword && stored?.playerName) {
        // Beitritt über den geteilten Einladungslink: Das Token aus der URL
        // ersetzt das Passwort (das Passwort bleibt so geheim).
        const inviteToken = getInviteTokenFromUrl();
        if (inviteToken) {
          s.emit("join", { playerName: stored.playerName, inviteToken });
        } else if (stored?.password) {
          s.emit("join", { playerName: stored.playerName, password: stored.password });
        }
      }
    });
    s.on("disconnect", () => {
      setConnected(false);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    });
    s.on("state", (payload) => {
      setState(payload);
      if (meRef.current && payload?.players) {
        const self = payload.players.find((p) => p.playerId === meRef.current.playerId);
        if (self) {
          setMe((prev) =>
            prev
              ? {
                  ...prev,
                  name: self.name ?? prev.name,
                  isHost: self.isHost,
                  isAdmin: self.isAdmin,
                  canChangeName: self.canChangeName,
                }
              : prev
          );
        }
      }
    });
    s.on("joined", (payload) => {
      setReconnectGaveUp(false);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setMe(payload);
      const stored = getStoredPlayer();
      setStoredPlayer({
        playerId: payload.playerId,
        playerName: stored?.playerName ?? payload.name ?? null,
        password: stored?.password ?? null,
        canChangeName: payload.canChangeName,
        reconnectToken: payload.reconnectToken,
      });
      setJoinError(null);
    });
    s.on("join_error", (payload) => {
      const code = payload?.code;
      if (code === "banned" || code === "kicked") {
        const stored = getStoredPlayer();
        if (stored) {
          // Keep name, but clear password and token
          setStoredPlayer({
            ...stored,
            password: null,
            reconnectToken: null,
            playerId: null
          });
        } else {
          clearStoredPlayer();
        }
        
        setLastJoinError(code, payload?.message || (code === "banned" ? "Du bist für diesen Raum gesperrt." : "Du wurdest aus der laufenden Runde entfernt."));
        setMe(null);
        setJoinError(payload?.message || (code === "banned" ? "Du bist für diesen Raum gesperrt." : "Du wurdest aus der laufenden Runde entfernt."));
        s.disconnect();
        return;
      }
      
      // Reconnect-Identität verwerfen, Name/Passwort für den nächsten Versuch behalten.
      const stored = getStoredPlayer();
      if (stored) {
        setStoredPlayer({
          ...stored,
          playerId: null,
          reconnectToken: null,
        });
      }
      setMe(null);
      setJoinError(payload.message || code);
      // Socket bewusst verbunden lassen: So bleibt die Live-Spielerzahl auf der
      // Join-Maske aktuell, und ein erneuter Versuch löst keinen doppelten
      // Auto-Join über den connect-Handler aus.
    });
    s.on("error", (payload) => setError(payload.message || payload.code));
    s.on("player_updated", (payload) => {
      if (meRef.current?.playerId === payload.playerId && payload.updates?.name) {
        const stored = getStoredPlayer();
        setStoredPlayer({ ...stored, playerName: payload.updates.name });
      }
      setState((prev) => {
        if (!prev?.players) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.playerId === payload.playerId ? { ...p, ...payload.updates } : p
          ),
        };
      });
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  const join = useCallback(
    (playerName, password, inviteToken = null) => {
      if (!socket) return;
      setJoinError(null);
      const stored = getStoredPlayer();
      const name = (playerName || "").trim() || "Unbekannt";
      setStoredPlayer({ ...stored, playerName: name, password: password || undefined });
      if (!socket.connected) {
        // Kein emit auf den getrennten Socket: Socket.io würde ihn puffern UND
        // der connect-Handler würde zusätzlich auto-joinen – der doppelte Join
        // endete dann in einem falschen "name_taken". Die Zugangsdaten stehen
        // bereits im Storage, der connect-Handler übernimmt den Beitritt.
        socket.connect();
        return;
      }
      socket.emit("join", {
        playerName: name,
        password: password || undefined,
        inviteToken: inviteToken || undefined,
        playerId: stored?.playerId ?? undefined,
        reconnectToken: stored?.reconnectToken ?? undefined,
      });
    },
    [socket]
  );

  const emit = useCallback(
    (event, payload = {}) => {
      if (socket) socket.emit(event, payload);
    },
    [socket]
  );

  const leave = useCallback(() => {
    // Beim Verlassen der Runde behalten wir nur den Namen lokal.
    // Reconnect-Identität wird bewusst verworfen, um saubere Neueinwahl zu erzwingen.
    setMe(null);
    setJoinError(null);
    setError(null);
    const stored = getStoredPlayer();
    if (stored) {
      setStoredPlayer({
        playerName: stored.playerName ?? null,
        password: null,
        playerId: null,
        reconnectToken: null,
        canChangeName: true,
      });
    }
    if (socket) {
      socket.disconnect();
    }
  }, [socket]);

  const stored = typeof window !== "undefined" ? getStoredPlayer() : {};
  const storedBanKick = typeof window !== "undefined" ? getLastJoinError() : null;
  // Sobald ein Join-Fehler vorliegt, ist der Wiederverbindungs-Versuch
  // gescheitert – dann gehört die Join-Maske (mit Fehlermeldung) auf den
  // Schirm, nicht weitere 30 Sekunden Spinner.
  const reconnecting =
    !reconnectGaveUp &&
    !joinError &&
    !me &&
    !storedBanKick &&
    stored?.playerName &&
    ((stored?.playerId && stored?.reconnectToken) || stored?.password);

  useEffect(() => {
    if (!reconnecting) return;
    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectGaveUp(true);
      setMe(null);
    }, 30000);
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [reconnecting]);

  const value = {
    socket,
    connected,
    state,
    me,
    joinError,
    error,
    setError,
    setJoinError,
    join,
    emit,
    leave,
    setState,
    reconnecting,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
