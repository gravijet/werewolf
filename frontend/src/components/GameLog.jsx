import React from "react";
import { Card } from "./Card";
import { t } from "../i18n/translations";

const LOG_ICON = {
  victim_werwolf: "pets",
  victim_hexe: "science",
  lynch: "gavel",
  jaeger_shot: "sports_martial_arts",
  lover_death: "heart_broken",
};

const LOG_KEY = {
  victim_werwolf: "logVictimWerwolf",
  victim_hexe: "logVictimHexe",
  lynch: "logLynch",
  jaeger_shot: "logJaegerShot",
  lover_death: "logLoverDeath",
};

/** Einheitliche Darstellung des Spielprotokolls (Geist- & Spielende-Screen). */
export function GameLog({ lang, entries = [] }) {
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {entries.length === 0 ? (
        <p style={{ padding: "32px 24px", textAlign: "center", color: "var(--md-sys-color-on-surface-variant)", margin: 0, fontSize: 15, fontWeight: 500 }}>
          {t(lang, "emptyLog")}
        </p>
      ) : (
        entries.map((entry, i) => {
          const key = LOG_KEY[entry.messageKey];
          const text = key ? t(lang, key).replace("{name}", entry.playerName ?? "") : entry.messageKey;
          return (
            <div
              key={i}
              style={{
                padding: "14px 18px",
                fontSize: 15,
                fontWeight: 500,
                color: "var(--md-sys-color-on-surface)",
                borderBottom: i < entries.length - 1 ? "1px solid var(--hairline)" : "none",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--md-sys-color-on-surface-variant)",
                  background: "var(--md-sys-color-surface-variant)",
                  padding: "4px 9px",
                  borderRadius: 999,
                  flexShrink: 0,
                }}
              >
                {entry.phase === "night" ? `N${entry.round}` : `T${entry.round}`}
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--md-sys-color-primary)", flexShrink: 0 }}>
                {LOG_ICON[entry.messageKey] || "circle"}
              </span>
              <span style={{ lineHeight: 1.45 }}>{text}</span>
            </div>
          );
        })
      )}
    </Card>
  );
}
