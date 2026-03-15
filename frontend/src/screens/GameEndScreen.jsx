import React from "react";
import { useGame } from "../context/GameContext";
import { t } from "../i18n/translations";

export function GameEndScreen({ lang }) {
  const { state } = useGame();
  const winner = state?.winner;
  
  const isVillage = winner === "village";
  const isWerewolf = winner === "werwolf";
  const isLovers = winner === "lovers";
  const isKopfgeldjaeger = winner === "kopfgeldjaeger";

  const bg = isVillage || isLovers ? "var(--md-sys-color-secondary-container)" : isKopfgeldjaeger ? "var(--md-sys-color-tertiary-container)" : "var(--md-sys-color-error-container)";
  const fg = isVillage || isLovers ? "var(--md-sys-color-on-secondary-container)" : isKopfgeldjaeger ? "var(--md-sys-color-on-tertiary-container)" : "var(--md-sys-color-on-error-container)";
  const accent = isVillage || isLovers ? "var(--md-sys-color-secondary)" : isKopfgeldjaeger ? "var(--md-sys-color-tertiary)" : "var(--md-sys-color-error)";
  const accentOn = isVillage || isLovers ? "var(--md-sys-color-on-secondary)" : isKopfgeldjaeger ? "var(--md-sys-color-on-tertiary)" : "var(--md-sys-color-on-error)";

  const winnerText = isVillage ? t(lang, "villageWins") : isWerewolf ? t(lang, "werewolvesWin") : isLovers ? (t(lang, "loversWin") || "Das Liebespaar gewinnt!") : isKopfgeldjaeger ? (t(lang, "kopfgeldjaegerWins") || "Der Kopfgeldjäger gewinnt!") : t(lang, "villageWins");

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        paddingTop: "max(24px, var(--safe-top))",
        paddingBottom: "max(24px, var(--safe-bottom))",
        background: bg,
        color: fg,
        textAlign: "center",
      }}
    >
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        width: 120, 
        height: 120, 
        borderRadius: "50%", 
        background: accent,
        color: accentOn,
        marginBottom: 32,
        boxShadow: "var(--shadow-3)"
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 64 }}>emoji_events</span>
      </div>
      <h1 style={{ fontSize: 40, fontWeight: 800, margin: "0 0 16px", letterSpacing: "-0.04em" }}>{t(lang, "gameEnd")}</h1>
      <p style={{ fontSize: 24, fontWeight: 600, margin: 0, letterSpacing: "-0.01em", opacity: 0.9 }}>
        {winnerText}
      </p>
    </div>
  );
}
