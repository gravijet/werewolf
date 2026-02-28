import React from "react";
import { t } from "../i18n/translations";

const PHASES = [
  { key: "phaseLobby", phase: "lobby", icon: "group" },
  { key: "phaseMayor", phase: "mayor_election", icon: "military_tech" },
  { key: "phaseNight", phase: "night", icon: "dark_mode" },
  { key: "phaseDay", phase: "day", icon: "light_mode" },
  { key: "phaseEnd", phase: "game_end", icon: "emoji_events" },
];

export function PhaseBar({ currentPhase, lang }) {
  const idx = PHASES.findIndex((p) => p.phase === currentPhase);
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: 8 }}>
      {PHASES.map((p, i) => {
        const done = i < idx;
        const current = i === idx;
        const active = done || current;
        return (
          <div
            key={p.phase}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              opacity: active ? 1 : 0.5,
              position: "relative",
            }}
          >
            {i > 0 && (
              <div 
                style={{
                  position: "absolute",
                  top: 14,
                  left: "-50%",
                  width: "100%",
                  height: 2,
                  background: active ? "var(--md-sys-color-primary)" : "var(--md-sys-color-surface-variant)",
                  zIndex: 0,
                }}
              />
            )}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: current ? "var(--md-sys-color-primary)" : done ? "var(--md-sys-color-primary-container)" : "var(--md-sys-color-surface-variant)",
                color: current ? "var(--md-sys-color-on-primary)" : done ? "var(--md-sys-color-on-primary-container)" : "var(--md-sys-color-on-surface-variant)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
                boxShadow: current ? "0 0 0 4px var(--md-sys-color-primary-container)" : "none",
                transition: "all 0.3s cubic-bezier(0.2, 0, 0, 1)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {done ? "check" : p.icon}
              </span>
            </div>
            <span style={{ 
              fontSize: 10, 
              fontWeight: current ? 600 : 500, 
              color: current ? "var(--md-sys-color-primary)" : "var(--md-sys-color-on-surface-variant)",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              textAlign: "center",
            }}>
              {t(lang, p.key)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
