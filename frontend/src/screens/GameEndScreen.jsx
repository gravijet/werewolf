import React, { useState } from "react";
import { useGame } from "../context/GameContext";
import { Button } from "../components/Button";
import { Confetti } from "../components/Confetti";
import { RoleRevealGrid } from "../components/RoleRevealGrid";
import { GameLog } from "../components/GameLog";
import { ConfirmModal } from "../components/ConfirmModal";
import { t } from "../i18n/translations";

const WINNERS = {
  village: { grad: "linear-gradient(135deg,#1e8e3e 0%,#4285f4 100%)", icon: "groups", key: "villageWins" },
  werwolf: { grad: "linear-gradient(135deg,#d93025 0%,#7b1fa2 100%)", icon: "pets", key: "werewolvesWin" },
  lovers: { grad: "linear-gradient(135deg,#ec407a 0%,#b3008e 100%)", icon: "favorite", key: "loversWin" },
  kopfgeldjaeger: { grad: "linear-gradient(135deg,#7c4dff 0%,#b3008e 100%)", icon: "crisis_alert", key: "kopfgeldjaegerWins" },
};

export function GameEndScreen({ lang }) {
  const { state, me, emit, leave } = useGame();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const winner = state?.winner;
  const players = state?.players ?? [];
  const gameLog = state?.gameLog ?? [];
  const stats = state?.stats;
  const isHostOrAdmin = me?.isHost || me?.isAdmin;

  const cfg = WINNERS[winner] || { grad: "var(--hero-gradient)", icon: "emoji_events", key: "villageWins" };
  const winnerText = t(lang, cfg.key);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--md-sys-color-background)" }}>
      <Confetti />

      <header
        style={{
          textAlign: "center",
          padding: "calc(var(--safe-top) + 56px) 20px 36px",
        }}
      >
        <div
          className="pop-in"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 116,
            height: 116,
            borderRadius: "50%",
            background: cfg.grad,
            color: "#fff",
            marginBottom: 24,
            boxShadow: "var(--shadow-3)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 62 }}>{cfg.icon}</span>
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 8px" }}>
          {t(lang, "gameEnd")} · {t(lang, "winningTeam")}
        </p>
        <h1
          className="slide-up"
          style={{
            fontSize: "clamp(2rem, 7vw, 3rem)",
            fontWeight: 800,
            margin: 0,
            letterSpacing: "-0.03em",
            background: cfg.grad,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
          }}
        >
          {winnerText}
        </h1>
      </header>

      <main style={{ flex: 1, width: "min(900px, 100%)", margin: "0 auto", padding: "0 16px 24px", paddingLeft: "max(16px, var(--safe-left))", paddingRight: "max(16px, var(--safe-right))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 16px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--md-sys-color-primary)" }}>visibility</span>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--md-sys-color-on-surface)", margin: 0, letterSpacing: "-0.01em" }}>
            {t(lang, "roleReveal")}
          </h2>
        </div>
        <RoleRevealGrid lang={lang} players={players} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "32px 0 16px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--md-sys-color-primary)" }}>history</span>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--md-sys-color-on-surface)", margin: 0, letterSpacing: "-0.01em" }}>
            {t(lang, "gameLog")}
          </h2>
        </div>
        <GameLog lang={lang} entries={gameLog} />

        {stats?.gamesPlayed > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "32px 0 16px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--md-sys-color-primary)" }}>leaderboard</span>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--md-sys-color-on-surface)", margin: 0, letterSpacing: "-0.01em" }}>
                {t(lang, "statsTitle")}
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
              {[
                { label: t(lang, "statsGames"), value: stats.gamesPlayed, icon: "casino", color: "var(--md-sys-color-primary)" },
                { label: t(lang, "teamVillage"), value: stats.wins?.village ?? 0, icon: "groups", color: "var(--g-blue)" },
                { label: t(lang, "teamWerewolf"), value: stats.wins?.werwolf ?? 0, icon: "pets", color: "var(--g-red)" },
                { label: t(lang, "teamLovers"), value: stats.wins?.lovers ?? 0, icon: "favorite", color: "#ec407a" },
                { label: t(lang, "kopfgeldjaeger"), value: stats.wins?.kopfgeldjaeger ?? 0, icon: "crisis_alert", color: "#7c4dff" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: "16px 12px",
                    borderRadius: 16,
                    background: "var(--md-sys-color-surface)",
                    border: "1px solid var(--hairline)",
                    textAlign: "center",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: item.color }}>{item.icon}</span>
                  <p style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 2px", color: "var(--md-sys-color-on-surface)" }}>{item.value}</p>
                  <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: "var(--md-sys-color-on-surface-variant)" }}>{item.label}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <footer
        style={{
          position: "sticky",
          bottom: 0,
          padding: "16px",
          paddingBottom: "max(16px, var(--safe-bottom))",
          paddingLeft: "max(16px, var(--safe-left))",
          paddingRight: "max(16px, var(--safe-right))",
          background: "color-mix(in srgb, var(--md-sys-color-surface) 86%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid var(--hairline)",
          display: "flex",
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        {isHostOrAdmin ? (
          <>
            <Button
              variant="filled"
              onClick={() => emit("restart_game")}
              style={{ flex: 1, minWidth: 180, maxWidth: 320, padding: "16px", fontSize: 16 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>replay</span>
              {t(lang, "playAgain")}
            </Button>
            <Button variant="tonal" onClick={() => setShowLeaveConfirm(true)} style={{ flex: 1, minWidth: 140, maxWidth: 240, padding: "16px", fontSize: 15 }}>
              {t(lang, "leaveRound")}
            </Button>
          </>
        ) : (
          <Button variant="tonal" onClick={() => setShowLeaveConfirm(true)} style={{ minWidth: 200, padding: "16px", fontSize: 15 }}>
            {t(lang, "leaveRound")}
          </Button>
        )}
      </footer>

      <ConfirmModal
        open={showLeaveConfirm}
        title={t(lang, "leaveRound")}
        message={t(lang, "leaveRoundHint")}
        confirmLabel={t(lang, "leaveRound")}
        cancelLabel={t(lang, "closeLabel")}
        onConfirm={() => { setShowLeaveConfirm(false); leave(); }}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </div>
  );
}
