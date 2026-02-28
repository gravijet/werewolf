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
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 1000 }}>
      <select
        value={lang}
        onChange={(e) => {
          setLang(e.target.value);
          setStoredLanguage(e.target.value);
        }}
        style={{
          background: "var(--md-sys-color-surface)",
          color: "var(--md-sys-color-on-surface)",
          border: "1px solid var(--md-sys-color-outline-variant)",
          padding: "8px 12px",
          borderRadius: 8,
          fontSize: 14,
          cursor: "pointer"
        }}
      >
        <option value="de">Deutsch</option>
        <option value="en">English</option>
        <option value="sv">Svenska</option>
      </select>
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
