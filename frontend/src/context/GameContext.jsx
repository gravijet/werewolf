import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { getStoredPlayer, setStoredPlayer, clearStoredPlayer, clearStoredCredentials, setLastJoinError, getLastJoinError } from "../lib/storage";

const API_URL = import.meta.env.VITE_API_URL || "";

const GameContext = createContext(null);

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
        s.emit("join", { playerName: stored.playerName, password: stored?.password || "JUGENDINNSBRUCK" });
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
        if (self)
          setMe((prev) => (prev ? { ...prev, isHost: self.isHost, isAdmin: self.isAdmin, canChangeName: self.canChangeName } : prev));
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
        
        setLastJoinError(code, payload?.message || (code === "banned" ? "Du wurdest aus dem Raum ausgewiesen." : "Du wurdest aus dem Raum entfernt."));
        setMe(null);
        setJoinError(payload?.message || (code === "banned" ? "Du wurdest aus dem Raum ausgewiesen." : "Du wurdest aus dem Raum entfernt."));
        s.disconnect();
        return;
      }
      
      // If we tried to rejoin but the game started and token is invalid, we should not loop.
      const isNoPassword = typeof window !== "undefined" && window.location.pathname === "/nopassword";
      const stored = getStoredPlayer();
      if (stored) {
        // We only clear the reconnect token and ID, but keep the name and password so they can try again later
        setStoredPlayer({
          ...stored,
          playerId: null,
          reconnectToken: null,
        });
      }
      setMe(null);
      setJoinError(payload.message || code);
      s.disconnect();
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
    (playerName, password) => {
      if (!socket) return;
      setJoinError(null);
      const stored = getStoredPlayer();
      const name = (playerName || "").trim() || "Spieler";
      setStoredPlayer({ ...stored, playerName: name, password: password || undefined });
      socket.emit("join", {
        playerName: name,
        password,
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
    // Wenn der Nutzer "Runde verlassen" klickt,
    // bleibt er eingeloggt. Wir trennen nur die aktive Verbindung temporär.
    // Ein Seiten-Neuladen würde ihn automatisch wieder verbinden.
    setMe(null);
    setJoinError(null);
    setError(null);
    if (socket) {
      socket.disconnect();
    }
  }, [socket]);

  const stored = typeof window !== "undefined" ? getStoredPlayer() : {};
  const storedBanKick = typeof window !== "undefined" ? getLastJoinError() : null;
  const reconnecting =
    !reconnectGaveUp &&
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
