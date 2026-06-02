import React from "react";
import { useGame } from "../context/GameContext";
import { RoleRevealGrid } from "../components/RoleRevealGrid";
import { GameLog } from "../components/GameLog";
import { t } from "../i18n/translations";

export function DeadScreen({ lang }) {
  const { state } = useGame();
  const players = state?.players ?? [];
  const gameLog = state?.gameLog ?? [];

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--md-sys-color-background)" }}>
      <header
        className="glass"
        style={{
          padding: "calc(var(--safe-top) + 44px) 20px 32px",
          textAlign: "center",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <div className="floaty" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: "50%", background: "var(--md-sys-color-surface-variant)", color: "var(--md-sys-color-on-surface-variant)", marginBottom: 20 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40 }}>visibility_off</span>
        </div>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: "var(--md-sys-color-on-surface)", margin: "0 0 8px", letterSpacing: "-0.02em" }}>{t(lang, "youDied")}</h2>
        <p style={{ fontSize: 16, fontWeight: 500, color: "var(--md-sys-color-on-surface-variant)", margin: 0, letterSpacing: "-0.01em" }}>{t(lang, "spectatorMode")}</p>
      </header>

      <div style={{ flex: 1, width: "min(900px, 100%)", margin: "0 auto", padding: "20px 16px", paddingLeft: "max(16px, var(--safe-left))", paddingRight: "max(16px, var(--safe-right))", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--md-sys-color-primary)" }}>group</span>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--md-sys-color-primary)", margin: 0, letterSpacing: "-0.01em" }}>
            {t(lang, "finalRoles")}
          </p>
        </div>
        <div style={{ marginBottom: 40 }}>
          <RoleRevealGrid lang={lang} players={players} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--md-sys-color-primary)" }}>history</span>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--md-sys-color-primary)", margin: 0, letterSpacing: "-0.01em" }}>
            {t(lang, "gameLog")}
          </p>
        </div>
        <GameLog lang={lang} entries={gameLog} />
      </div>
    </div>
  );
}
