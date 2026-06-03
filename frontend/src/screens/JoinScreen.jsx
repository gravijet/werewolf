import React, { useState, useEffect, useRef } from "react";
import { useGame } from "../context/GameContext";
import { getStoredPlayer, consumeLastJoinError } from "../lib/storage";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { t } from "../i18n/translations";

export function JoinScreen({ lang, setLang }) {
  const { join, joinError, setJoinError, state, me } = useGame();
  const [playerName, setPlayerName] = useState("");
  const [password, setPassword] = useState("");
  const isNoPassword = typeof window !== "undefined" && window.location.pathname === "/nopassword";
  const hasClearedConsumedError = useRef(false);

  useEffect(() => {
    const stored = getStoredPlayer();
    if (stored?.playerName) setPlayerName(stored.playerName);
    if (stored?.password && !isNoPassword) {
      setPassword(stored.password);
    } else {
      setPassword("");
    }
  }, [isNoPassword]);

  useEffect(() => {
    const lastError = consumeLastJoinError();
    if (lastError) setJoinError(lastError);
  }, [setJoinError]);

  useEffect(() => {
    if (!hasClearedConsumedError.current) {
      hasClearedConsumedError.current = true;
      return;
    }
    // Only clear join error if the user actually typed something new
    // to avoid clearing the error immediately after it was set by the server
  }, [playerName, password]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isNoPassword) {
      if (!playerName.trim()) {
        setJoinError(t(lang, "noNameProvided"));
        return;
      }
      join(playerName.trim(), "WOLFGAME");
    } else {
      join(playerName.trim() || "Unbekannt", password);
    }
  };

  const playerCount = state?.players?.filter((p) => !p.isHost).length ?? 0;

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        paddingLeft: "max(20px, var(--safe-left))",
        paddingRight: "max(34px, var(--safe-right))",
        paddingTop: "max(34px, var(--safe-top))",
        background: "transparent",
        gap: 32,
      }}
    >
      <div className="fade-in" style={{ textAlign: "center", marginBottom: 6, maxWidth: 540 }}>
        <div
          className="floaty"
          style={{
            width: 88,
            height: 88,
            margin: "0 auto 22px",
            borderRadius: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--hero-gradient)",
            boxShadow: "var(--shadow-glow)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#fff" }}>pets</span>
        </div>
        <h1
          className="gradient-text-animated"
          style={{
            fontSize: 48,
            fontWeight: 800,
            marginBottom: 0,
            letterSpacing: "-0.03em",
          }}
        >
          {t(lang, "appTitle")}
        </h1>
        {t(lang, "appSubtitle") && (
          <p
            style={{
              fontSize: 18,
              fontWeight: 400,
              color: "var(--md-sys-color-on-surface-variant)",
              marginTop: 10,
              marginBottom: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {t(lang, "appSubtitle")}
          </p>
        )}
        <div className="g-dots" style={{ marginTop: 16, justifyContent: "center" }} aria-hidden>
          <i /><i /><i /><i />
        </div>
      </div>

      <Card style={{ width: "100%", maxWidth: 460, padding: "40px 36px 34px" }}>
        <div className="g-accent-bar g-accent-bar-animated" style={{ margin: "-40px -36px 28px", width: "auto", borderRadius: 0 }} aria-hidden />
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Input
            label={t(lang, "yourName")}
            placeholder={t(lang, "namePlaceholder")}
            value={playerName}
            onChange={setPlayerName}
          />
          {!isNoPassword && (
            <div>
              <Input
                label={t(lang, "password")}
                type="password"
                placeholder={t(lang, "passwordPlaceholder")}
                value={password}
                onChange={setPassword}
              />
            </div>
          )}
          {joinError && (
            <div
              style={{
                color: "var(--md-sys-color-error)",
                fontSize: 14,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--md-sys-color-error-container)",
                padding: "10px 14px",
                borderRadius: "var(--radius)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>error</span>
              {joinError}
            </div>
          )}
          <Button type="submit" fullWidth style={{ marginTop: 10, padding: "16px", fontSize: 16 }}>
            {t(lang, "joinBtn")}
          </Button>
        </form>
      </Card>

      {!me && state && (
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            marginTop: 0,
            padding: "16px 20px",
            background: "var(--md-sys-color-secondary-container)",
            color: "var(--md-sys-color-on-secondary-container)",
            borderRadius: "var(--radius-xl)",
            fontSize: 15,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>group</span>
          <span>
            <strong style={{ color: "var(--md-sys-color-primary)" }}>{playerCount}</strong>{" "}
            {t(lang, "players")} {t(lang, "playersWaiting")}
          </span>
        </div>
      )}
    </div>
  );
}
