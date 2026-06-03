import React, { useState, useEffect } from "react";
import { GameProvider, useGame } from "./context/GameContext";
import { getStoredLanguage, setStoredLanguage, t } from "./i18n/translations";
import { getStoredTheme, setStoredTheme } from "./lib/storage";
import { JoinScreen } from "./screens/JoinScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { MayorScreen } from "./screens/MayorScreen";
import { NightScreen } from "./screens/NightScreen";
import { DayScreen } from "./screens/DayScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { JaegerShotScreen } from "./screens/JaegerShotScreen";
import { GameEndScreen } from "./screens/GameEndScreen";
import { DeadScreen } from "./screens/DeadScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { Button } from "./components/Button";
import { ConfirmModal } from "./components/ConfirmModal";
import { Snackbar } from "./components/Snackbar";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : true
  );
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 768px)");
    const onChange = (event) => setIsMobile(event.matches);
    setIsMobile(media.matches);
    if (media.addEventListener) media.addEventListener("change", onChange);
    else media.addListener(onChange);
    return () => {
      if (media.removeEventListener) media.removeEventListener("change", onChange);
      else media.removeListener(onChange);
    };
  }, []);
  return isMobile;
}

/** Schwebendes Steuerungs-Cluster: Theme-Umschalter + Sprachauswahl. */
function FloatingControls({ lang, setLang, theme, toggleTheme }) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const languages = [
    { code: "de", label: "DE" },
    { code: "en", label: "EN" },
    { code: "sv", label: "SV" },
  ];

  const iconBtn = {
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    border: "1px solid var(--hairline)",
    background: "var(--md-sys-color-surface)",
    color: "var(--md-sys-color-on-surface)",
    cursor: "pointer",
    boxShadow: "var(--shadow-1)",
    transition: "transform 0.2s var(--motion-standard), background 0.2s",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: isMobile ? "auto" : "max(12px, var(--safe-top))",
        bottom: isMobile ? "max(14px, var(--safe-bottom))" : "auto",
        right: isMobile ? "max(14px, var(--safe-right))" : "max(12px, var(--safe-right))",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <button
        type="button"
        className="md-state-layer"
        onClick={toggleTheme}
        aria-label={t(lang, "toggleTheme")}
        title={theme === "dark" ? t(lang, "lightMode") : t(lang, "darkMode")}
        style={iconBtn}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
          {theme === "dark" ? "light_mode" : "dark_mode"}
        </span>
      </button>

      <div style={{ position: "relative" }}>
        <button
          type="button"
          className="md-state-layer"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            ...iconBtn,
            width: "auto",
            borderRadius: 22,
            padding: "0 16px",
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>language</span>
          {lang.toUpperCase()}
        </button>

        {isOpen && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 999 }}
              onClick={() => setIsOpen(false)}
            />
            <div
              className="pop-in"
              style={{
                position: "absolute",
                top: isMobile ? "auto" : "100%",
                bottom: isMobile ? "calc(100% + 8px)" : "auto",
                right: 0,
                marginTop: isMobile ? 0 : 8,
                background: "var(--md-sys-color-surface)",
                border: "1px solid var(--hairline)",
                borderRadius: 18,
                padding: 6,
                boxShadow: "var(--shadow-2)",
                zIndex: 1000,
                minWidth: 110,
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
                    background: lang === l.code ? "var(--md-sys-color-primary-container)" : "transparent",
                    color: lang === l.code ? "var(--md-sys-color-on-primary-container)" : "var(--md-sys-color-on-surface)",
                    border: "none",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: lang === l.code ? 700 : 500,
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AppContent() {
  const [lang, setLang] = useState(() => getStoredLanguage());
  const [theme, setTheme] = useState(() => getStoredTheme());
  const [adminOpen, setAdminOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const { state, me, error, setError, reconnecting, leave, connected } = useGame();

  useEffect(() => {
    if (error) {
      const id = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(id);
    }
  }, [error, setError]);

  // Theme (Light/Dark) und aktuelle Phase auf <html> anwenden → steuert die Farbwelt.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.phase = state?.phase || "lobby";
  }, [state?.phase]);

  const toggleTheme = () =>
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      setStoredTheme(next);
      return next;
    });

  const controls = (
    <FloatingControls lang={lang} setLang={setLang} theme={theme} toggleTheme={toggleTheme} />
  );

  // Verbindungsabbruch-Banner: erscheint, sobald wir mitten in einer Sitzung
  // (Identität vorhanden) die Verbindung verlieren. Socket.io verbindet automatisch neu.
  const connBanner =
    me && !connected ? (
      <div
        className="slide-up"
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          top: "max(12px, var(--safe-top))",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1600,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 18px",
          borderRadius: 999,
          background: "var(--md-sys-color-error-container)",
          color: "var(--md-sys-color-on-error-container)",
          boxShadow: "var(--shadow-2)",
          fontSize: 14,
          fontWeight: 600,
          maxWidth: "92vw",
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            flexShrink: 0,
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(lang, "connectionLost")}</span>
      </div>
    ) : null;

  if (!me) {
    if (reconnecting) {
      return (
        <>
          {controls}
          <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--md-sys-color-background)", flexDirection: "column", gap: 16 }}>
            <div style={{ width: 48, height: 48, border: "3px solid var(--md-sys-color-primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t(lang, "reconnecting")}.</p>
          </div>
        </>
      );
    }
    return (
      <>
        {controls}
        <JoinScreen lang={lang} setLang={setLang} />
        <Snackbar open={Boolean(error)} message={error} tone="error" />
      </>
    );
  }

  const myPlayer = state?.players?.find((p) => p.playerId === me.playerId);
  const iAmDead = myPlayer && !myPlayer.isAlive && myPlayer.role !== "moderator" && !myPlayer.isHost;

  if (adminOpen) {
    return <AdminScreen lang={lang} onClose={() => setAdminOpen(false)} />;
  }

  if (state?.phase === "game_end") {
    return (
      <>
        {controls}
        {connBanner}
        <GameEndScreen lang={lang} />
      </>
    );
  }

  if (iAmDead && state?.phase !== "lobby") {
    return (
      <>
        {controls}
        {connBanner}
        <DeadScreen lang={lang} />
      </>
    );
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
      case "jaeger_shot":
        return <JaegerShotScreen lang={lang} />;
      default:
        return <LobbyScreen lang={lang} onOpenAdmin={() => setAdminOpen(true)} />;
    }
  })();

  const showLeaveButton = state?.phase && state.phase !== "lobby";
  const hostHasFooter = me?.isHost && ["mayor_election", "night", "day", "result", "jaeger_shot"].includes(state?.phase);
  const showGlobalLeave = showLeaveButton && !hostHasFooter;
  const showHostAdmin = me?.isHost && state?.phase && state.phase !== "lobby";
  const showNightBanner = state?.phase === "night";

  return (
    <>
      {controls}
      {connBanner}
      {showHostAdmin && (
        <button
          type="button"
          className="md-state-layer"
          onClick={() => setAdminOpen(true)}
          aria-label={t(lang, "gameSettings")}
          style={{
            position: "fixed",
            top: "max(16px, var(--safe-top))",
            left: "max(16px, var(--safe-left))",
            zIndex: 100,
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "1px solid var(--hairline)",
            background: "var(--md-sys-color-surface)",
            color: "var(--md-sys-color-on-surface)",
            boxShadow: "var(--shadow-2)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>settings</span>
        </button>
      )}
      {showNightBanner && (
        <div
          className="glass slide-up"
          style={{
            position: "fixed",
            top: "max(72px, calc(var(--safe-top) + 56px))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 90,
            width: "min(92vw, 560px)",
            borderRadius: 20,
            padding: "12px 18px 13px",
            textAlign: "center",
            boxShadow: "var(--shadow-2)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--md-sys-color-on-surface)", letterSpacing: "0" }}>
            {t(lang, "nightTitle")}
          </div>
          <div style={{ fontSize: 14, fontWeight: 400, color: "var(--md-sys-color-on-surface-variant)" }}>
            {t(lang, "nightCloseEyes")}
          </div>
        </div>
      )}
      {screen}
      {showGlobalLeave && (
        <div style={{ position: "fixed", bottom: "max(16px, var(--safe-bottom))", left: "50%", transform: "translateX(-50%)", zIndex: 100 }}>
          <Button
            variant="tonal"
            onClick={() => setShowLeaveConfirm(true)}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              boxShadow: "var(--shadow-2)",
              letterSpacing: "0.02em",
            }}
          >
            {t(lang, "leaveRound")}
          </Button>
        </div>
      )}
      <ConfirmModal
        open={showLeaveConfirm}
        title={t(lang, "leaveRound")}
        message={t(lang, "leaveRoundHint")}
        confirmLabel={t(lang, "leaveRound")}
        cancelLabel={t(lang, "closeLabel")}
        onConfirm={() => { setShowLeaveConfirm(false); leave(); }}
        onCancel={() => setShowLeaveConfirm(false)}
      />
      <Snackbar open={Boolean(error)} message={error} tone="error" />
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
