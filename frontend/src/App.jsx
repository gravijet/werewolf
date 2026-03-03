import React, { useState, useEffect } from "react";
import { GameProvider, useGame } from "./context/GameContext";
import { getStoredLanguage, setStoredLanguage, t } from "./i18n/translations";
import { JoinScreen } from "./screens/JoinScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { MayorScreen } from "./screens/MayorScreen";
import { NightScreen } from "./screens/NightScreen";
import { DayScreen } from "./screens/DayScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { GameEndScreen } from "./screens/GameEndScreen";
import { DeadScreen } from "./screens/DeadScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { Button } from "./components/Button";

function LanguageSwitcher({ lang, setLang }) {
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: "de", label: "DE" },
    { code: "en", label: "EN" },
    { code: "sv", label: "SV" }
  ];

  return (
    <div style={{ position: "fixed", top: 16, right: 80, zIndex: 1000 }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "var(--md-sys-color-surface)",
          color: "var(--md-sys-color-on-surface)",
          border: "1px solid var(--md-sys-color-outline-variant)",
          padding: "8px 12px",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          transition: "all 0.2s"
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>language</span>
        {lang.toUpperCase()}
      </button>

      {isOpen && (
        <>
          <div 
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
            onClick={() => setIsOpen(false)} 
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 8,
              background: "var(--md-sys-color-surface)",
              border: "1px solid var(--md-sys-color-outline-variant)",
              borderRadius: 12,
              padding: 4,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 1000,
              minWidth: 100
            }}
          >
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setLang(l.code);
                  setStoredLanguage(l.code);
                  setIsOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 16px",
                  background: lang === l.code ? "var(--md-sys-color-secondary-container)" : "transparent",
                  color: lang === l.code ? "var(--md-sys-color-on-secondary-container)" : "var(--md-sys-color-on-surface)",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: lang === l.code ? 700 : 500,
                  cursor: "pointer",
                  transition: "background 0.2s"
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AppContent() {
  const [lang, setLang] = useState(() => getStoredLanguage());
  const [adminOpen, setAdminOpen] = useState(false);
  const { state, me, error, setError, reconnecting, leave } = useGame();

  useEffect(() => {
    if (error) {
      const id = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(id);
    }
  }, [error, setError]);

  if (!me) {
    if (reconnecting) {
      return (
        <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--white)", flexDirection: "column", gap: 16 }}>
          <div style={{ width: 48, height: 48, border: "3px solid var(--blue)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Verbinde wieder …</p>
        </div>
      );
    }
    return (
      <>
        <JoinScreen lang={lang} setLang={setLang} />
        {error && (
          <div
            style={{
              position: "fixed",
              bottom: 24,
              left: 20,
              right: 20,
              maxWidth: 400,
              margin: "0 auto",
              padding: "14px 20px",
              background: "var(--error-bg)",
              color: "var(--error)",
              border: "2px solid var(--error)",
              borderRadius: "var(--radius-lg)",
              fontSize: 14,
              zIndex: 9999,
            }}
          >
            {error}
          </div>
        )}
      </>
    );
  }

  const myPlayer = state?.players?.find((p) => p.playerId === me.playerId);
  const iAmDead = myPlayer && !myPlayer.isAlive && myPlayer.role !== "moderator";

  if (adminOpen) {
    return <AdminScreen lang={lang} onClose={() => setAdminOpen(false)} />;
  }

  if (state?.phase === "game_end") {
    return <GameEndScreen lang={lang} />;
  }

  if (iAmDead && state?.phase !== "lobby") {
    return <DeadScreen lang={lang} />;
  }

  const screen = (() => {
    switch (state?.phase) {
      case "lobby":
        return <LobbyScreen lang={lang} onOpenAdmin={() => setAdminOpen(true)} />;
      case "mayor_election":
        return <MayorScreen lang={lang} />;
      case "night":
        return <NightScreen lang={lang} />;
      case "day":
        return <DayScreen lang={lang} />;
      case "result":
        return <ResultScreen lang={lang} />;
      default:
        return <LobbyScreen lang={lang} onOpenAdmin={() => setAdminOpen(true)} />;
    }
  })();

  const showLeaveButton = state?.phase && state.phase !== "lobby";

  return (
    <>
      <LanguageSwitcher lang={lang} setLang={setLang} />
      {screen}
      {showLeaveButton && (
        <div style={{ position: "fixed", bottom: "max(16px, var(--safe-bottom))", left: "50%", transform: "translateX(-50%)", zIndex: 100 }}>
          <Button
            variant="tonal"
            onClick={() => {
              if (window.confirm(t(lang, "leaveRound") + "? Du bleibst angemeldet, wirst aber vom Spiel getrennt.")) {
                leave();
              }
            }}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              boxShadow: "var(--shadow-2)",
            }}
          >
            {t(lang, "leaveRound")}
          </Button>
        </div>
      )}
      {error && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: 20,
            right: 20,
            maxWidth: 400,
            margin: "0 auto",
            padding: "14px 20px",
            background: "var(--error-bg)",
            color: "var(--error)",
            border: "2px solid var(--error)",
            borderRadius: "var(--radius-lg)",
            fontSize: 14,
            zIndex: 9999,
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}
