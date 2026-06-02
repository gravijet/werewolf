import React, { useState } from "react";
import { useGame } from "../context/GameContext";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Avatar } from "../components/Avatar";
import { t } from "../i18n/translations";

export function JaegerShotScreen({ lang }) {
  const { state, me, emit } = useGame();
  const [selectedId, setSelectedId] = useState(null);
  const alive = (state?.players ?? []).filter((p) => p.isAlive && !p.isHost);
  const jaegerSourceId = state?.jaegerSourceId;
  const jaeger = jaegerSourceId ? state?.players?.find((p) => p.playerId === jaegerSourceId) : null;

  return (
    <div className="fade-in" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--md-sys-color-background)", padding: "calc(var(--safe-top) + 24px) 16px 24px" }}>
      <header style={{ textAlign: "center", marginBottom: 32 }}>
        <div className="pop-in" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: "50%", background: "var(--md-sys-color-primary-container)", color: "var(--md-sys-color-on-primary-container)", marginBottom: 16 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40 }}>sports_martial_arts</span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--md-sys-color-on-surface)", margin: "0 0 8px" }}>
          {t(lang, "jaegerShotTitle")}
        </h2>
        <p style={{ fontSize: 16, color: "var(--md-sys-color-on-surface-variant)", margin: 0 }}>
          {t(lang, "jaegerShotPrompt").replace("{name}", jaeger?.name || "Unbekannt")}
        </p>
      </header>

      {me?.isHost && (
        <Card variant="elevated" style={{ padding: 0, borderRadius: "var(--radius-xl)", overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--md-sys-color-outline-variant)", background: "var(--md-sys-color-surface-container)" }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--md-sys-color-on-surface-variant)" }}>{t(lang, "selectVictim")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: 16 }}>
            {alive.map((p) => (
              <button
                key={p.playerId}
                type="button"
                className="md-state-layer"
                onClick={() => setSelectedId(selectedId === p.playerId ? null : p.playerId)}
                style={{
                  padding: "16px 12px",
                  borderRadius: "var(--radius-lg)",
                  border: `2px solid ${selectedId === p.playerId ? "var(--md-sys-color-tertiary)" : "transparent"}`,
                  background: selectedId === p.playerId ? "var(--md-sys-color-tertiary-container)" : "var(--md-sys-color-surface-container-low)",
                  color: "var(--md-sys-color-on-surface)",
                  textAlign: "center",
                  cursor: "pointer",
                }}
              >
                <Avatar name={p.name} size={48} style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{p.name}</p>
              </button>
            ))}
          </div>
          <div style={{ padding: "0 16px 16px" }}>
            <Button fullWidth disabled={!selectedId} onClick={() => selectedId && emit("jaeger_kill", { targetId: selectedId })} style={{ padding: "16px" }}>
              {t(lang, "executeShot")}
            </Button>
          </div>
        </Card>
      )}

      {!me?.isHost && (
        <p style={{ textAlign: "center", color: "var(--md-sys-color-on-surface-variant)", fontSize: 16 }}>{t(lang, "hostSelectingJaegerVictim")}</p>
      )}
    </div>
  );
}
