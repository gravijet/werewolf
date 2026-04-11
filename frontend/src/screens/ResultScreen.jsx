import React from "react";
import { useGame } from "../context/GameContext";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { t } from "../i18n/translations";

export function ResultScreen({ lang }) {
  const { state, me, emit, leave } = useGame();
  const day = state?.day;
  const night = state?.night;
  const eliminatedId = day?.eliminatedId;
  const victimId = night?.victimId;
  const jaegerKillId = day?.jaegerKillId;
  const eliminated = eliminatedId ? state?.players?.find((p) => p.playerId === eliminatedId) : null;
  const victim = victimId ? state?.players?.find((p) => p.playerId === victimId) : null;
  const jaegerKill = jaegerKillId ? state?.players?.find((p) => p.playerId === jaegerKillId) : null;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--md-sys-color-background)", padding: "24px 16px", paddingLeft: "max(16px, var(--safe-left))", paddingRight: "max(16px, var(--safe-right))", paddingTop: "max(24px, var(--safe-top))" }}>
      <header style={{ marginBottom: 32, textAlign: "center", marginTop: 16 }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: "50%", background: "var(--md-sys-color-primary-container)", color: "var(--md-sys-color-on-primary-container)", marginBottom: 20 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40 }}>campaign</span>
        </div>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: "var(--md-sys-color-on-surface)", margin: 0, letterSpacing: "-0.02em" }}>{t(lang, "result")}</h2>
      </header>

      {eliminated && (
        <Card style={{ padding: "28px 24px", marginBottom: 20, background: "var(--md-sys-color-error-container)", borderColor: "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: "var(--md-sys-color-error)" }}>person_remove</span>
            <div>
              <p style={{ fontSize: 20, fontWeight: 700, color: "var(--md-sys-color-on-error-container)", margin: 0, letterSpacing: "-0.01em" }}>
                {eliminated.name} {t(lang, "eliminated")}
              </p>
            </div>
          </div>
        </Card>
      )}

      {jaegerKill && (
        <Card style={{ padding: "28px 24px", marginBottom: 20, background: "var(--md-sys-color-tertiary-container)", borderColor: "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: "var(--md-sys-color-tertiary)" }}>sports_martial_arts</span>
            <div>
              <p style={{ fontSize: 18, fontWeight: 700, color: "var(--md-sys-color-on-tertiary-container)", margin: 0, letterSpacing: "-0.01em" }}>
                {jaegerKill.name} wurde vom Jaeger getroffen
              </p>
            </div>
          </div>
        </Card>
      )}

      {victim && !eliminated && !jaegerKill && (
        <Card style={{ padding: "28px 24px", marginBottom: 20, background: "var(--md-sys-color-surface-container)", borderColor: "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: "var(--md-sys-color-on-surface-variant)" }}>sentiment_dissatisfied</span>
            <div>
              <p style={{ fontSize: 18, color: "var(--md-sys-color-on-surface)", margin: 0, fontWeight: 600, letterSpacing: "-0.01em" }}>
                {victim.name} {t(lang, "killedLastNight")}
              </p>
            </div>
          </div>
        </Card>
      )}

      {!eliminated && !victim && !jaegerKill && (
        <Card style={{ padding: "28px 24px", marginBottom: 20, background: "var(--md-sys-color-surface-container-high)", borderColor: "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: "var(--success)" }}>gavel</span>
            <div>
              <p style={{ fontSize: 18, color: "var(--md-sys-color-on-surface)", margin: 0, fontWeight: 600, letterSpacing: "-0.01em" }}>
                {t(lang, "noLynch")}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div style={{ flex: 1 }} />

      {me?.isHost && (
        <footer style={{ 
          marginTop: 32, 
          paddingBottom: "max(20px, var(--safe-bottom))",
          marginLeft: "-16px",
          marginRight: "-16px",
          marginBottom: "-24px",
          padding: "20px 16px",
          background: "var(--md-sys-color-surface)",
          borderTop: "1px solid var(--md-sys-color-outline-variant)",
        }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button variant="tonal" onClick={() => leave()} style={{ flex: 1, minWidth: 140, padding: "14px", fontSize: 15 }}>
              {t(lang, "leaveRound")}
            </Button>
            <Button variant="filled" style={{ flex: 1, minWidth: 140, padding: "14px", fontSize: 15 }} onClick={() => emit("phase_next")}>
              {t(lang, "nextRound")}
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}
