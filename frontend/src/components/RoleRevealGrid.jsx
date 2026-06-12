import React from "react";
import { Card } from "./Card";
import { Avatar } from "./Avatar";
import { t } from "../i18n/translations";

const ROLE_ICON = {
  werwolf: "pets",
  seher: "visibility",
  hexe: "science",
  dorfbewohner: "person",
  amor: "favorite",
  kopfgeldjaeger: "crisis_alert",
  jaeger: "sports_martial_arts",
  blinzelmaedchen: "child_care",
  baecker: "bakery_dining",
  beschuetzer: "shield",
  aelteste: "elderly",
  zwilling: "group",
  dorfdepp: "sentiment_very_dissatisfied",
  suendenbock: "balance",
  wildeskind: "nature_people",
  moderator: "admin_panel_settings",
};

const TEAM = {
  werwolf: "werewolf",
  seher: "village",
  hexe: "village",
  dorfbewohner: "village",
  amor: "village",
  jaeger: "village",
  blinzelmaedchen: "village",
  baecker: "village",
  beschuetzer: "village",
  aelteste: "village",
  zwilling: "village",
  dorfdepp: "village",
  suendenbock: "village",
  wildeskind: "village",
  kopfgeldjaeger: "solo",
  moderator: "moderator",
};

const TEAM_COLOR = {
  werewolf: "var(--g-red)",
  village: "var(--g-blue)",
  solo: "#7c4dff",
  moderator: "var(--md-sys-color-outline)",
};

/**
 * Zeigt alle Spieler mit Rolle, Team-Farbe und Status (lebt/ausgeschieden).
 * Wird auf dem Spielende- und dem Geist-Screen verwendet.
 */
export function RoleRevealGrid({ lang, players = [], showStatus = true }) {
  return (
    <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
      {players.map((p) => {
        const team = TEAM[p.role] || "village";
        const color = TEAM_COLOR[team];
        const icon = ROLE_ICON[p.role] || "help";
        const isDead = showStatus && p.isAlive === false && p.role !== "moderator";
        return (
          <Card
            key={p.playerId}
            style={{
              padding: "18px 12px 16px",
              textAlign: "center",
              borderRadius: 18,
              position: "relative",
              borderTop: `4px solid ${color}`,
              opacity: isDead ? 0.62 : 1,
              filter: isDead ? "grayscale(0.4)" : "none",
            }}
          >
            <div style={{ position: "relative", width: 56, height: 56, margin: "0 auto 10px" }}>
              <Avatar name={p.name} size={56} />
              <span
                className="material-symbols-outlined"
                style={{
                  position: "absolute",
                  bottom: -4,
                  right: -6,
                  fontSize: 18,
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: color,
                  color: "#fff",
                  boxShadow: "var(--shadow-1)",
                }}
              >
                {icon}
              </span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 2px", color: "var(--md-sys-color-on-surface)", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.name}
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color }}>
              {p.role ? (t(lang, p.role) || p.role) : "?"}
            </p>
            <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
              {p.isMayor && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--md-sys-color-tertiary-container)", color: "var(--md-sys-color-on-tertiary-container)" }}>
                  {t(lang, "mayor")}
                </span>
              )}
              {p.wasWildChild && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--md-sys-color-secondary-container)", color: "var(--md-sys-color-on-secondary-container)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>nature_people</span>
                  {t(lang, "wildeskind")}
                </span>
              )}
              {p.inLove && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--md-sys-color-tertiary-container)", color: "var(--md-sys-color-on-tertiary-container)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>favorite</span>
                  {t(lang, "teamLovers")}
                </span>
              )}
              {showStatus && p.role !== "moderator" && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: isDead ? "var(--md-sys-color-surface-variant)" : "var(--success-bg)",
                    color: isDead ? "var(--md-sys-color-on-surface-variant)" : "var(--success)",
                  }}
                >
                  {isDead ? t(lang, "dead") : t(lang, "alive")}
                </span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
