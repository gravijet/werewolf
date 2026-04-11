import React from "react";
import { useGame } from "../context/GameContext";
import { Card } from "../components/Card";
import { Avatar } from "../components/Avatar";
import { t } from "../i18n/translations";

export function DeadScreen({ lang }) {
  const { state } = useGame();
  const players = state?.players ?? [];
  const gameLog = state?.gameLog ?? [];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--md-sys-color-background)" }}>
      <header
        style={{
          background: "var(--md-sys-color-surface-container)",
          padding: "40px 20px 32px",
          textAlign: "center",
          borderBottom: "1px solid var(--md-sys-color-outline-variant)",
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: "50%", background: "var(--md-sys-color-surface-variant)", color: "var(--md-sys-color-on-surface-variant)", marginBottom: 20 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40 }}>visibility_off</span>
        </div>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: "var(--md-sys-color-on-surface)", margin: "0 0 8px", letterSpacing: "-0.02em" }}>{t(lang, "youDied")}</h2>
        <p style={{ fontSize: 16, fontWeight: 500, color: "var(--md-sys-color-on-surface-variant)", margin: 0, letterSpacing: "-0.01em" }}>{t(lang, "spectatorMode")}</p>
      </header>

      <div style={{ flex: 1, padding: "20px 16px", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--md-sys-color-primary)" }}>group</span>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--md-sys-color-primary)", margin: 0, letterSpacing: "-0.01em" }}>
            {t(lang, "allRoles")}
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 40 }}>
          {players.map((p) => (
            <Card
              key={p.playerId}
              variant="outlined"
              style={{
                padding: "20px 12px",
                textAlign: "center",
                background: "var(--md-sys-color-surface)",
                borderColor: "var(--md-sys-color-outline-variant)",
                borderRadius: "16px",
              }}
            >
              <Avatar name={p.name} size={56} style={{ margin: "0 auto 12px" }} />
              <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px", color: "var(--md-sys-color-on-surface)", letterSpacing: "-0.01em" }}>{p.name}</p>
              <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", margin: 0, fontWeight: 600 }}>
                {p.isMayor ? t(lang, "mayor") + " · " : ""}{p.role ? (t(lang, p.role) || p.role) : "?"}
              </p>
            </Card>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--md-sys-color-primary)" }}>history</span>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--md-sys-color-primary)", margin: 0, letterSpacing: "-0.01em" }}>
            {t(lang, "gameLog")}
          </p>
        </div>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {gameLog.length === 0 ? (
            <p style={{ padding: "32px 24px", textAlign: "center", color: "var(--md-sys-color-on-surface-variant)", margin: 0, fontSize: 15, fontWeight: 500 }}>
              {t(lang, "emptyLog")}
            </p>
          ) : (
            gameLog.map((entry, i) => (
              <div
                key={i}
                style={{
                  padding: "16px 20px",
                  fontSize: 15,
                  fontWeight: 500,
                  color: "var(--md-sys-color-on-surface)",
                  borderBottom: i < gameLog.length - 1 ? "1px solid var(--md-sys-color-outline-variant)" : "none",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                }}
              >
                <span style={{ 
                  fontSize: 13, 
                  fontWeight: 700, 
                  color: "var(--md-sys-color-on-surface-variant)", 
                  background: "var(--md-sys-color-surface-variant)",
                  padding: "4px 10px",
                  borderRadius: "var(--radius)",
                  display: "inline-block",
                  flexShrink: 0
                }}>
                  {entry.phase === "night" ? `N${entry.round}` : `T${entry.round}`}
                </span>
                <span style={{ paddingTop: 2, lineHeight: 1.5 }}>
                  {entry.messageKey === "victim_werwolf" && t(lang, "logVictimWerwolf").replace("{name}", entry.playerName)}
                  {entry.messageKey === "victim_hexe" && t(lang, "logVictimHexe").replace("{name}", entry.playerName)}
                  {entry.messageKey === "lynch" && t(lang, "logLynch").replace("{name}", entry.playerName)}
                  {entry.messageKey === "jaeger_shot" && t(lang, "logJaegerShot").replace("{name}", entry.playerName)}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
