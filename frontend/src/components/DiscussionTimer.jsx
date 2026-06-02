import React, { useEffect, useState } from "react";
import { t } from "../i18n/translations";

/**
 * Visueller Countdown für die Abstimmungs-/Diskussionsphase.
 * Rein informativ – beendet die Phase nicht automatisch (die Leitung behält die Kontrolle).
 */
export function DiscussionTimer({ lang, startedAt, durationSeconds }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!startedAt || !durationSeconds) return null;

  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return null;

  const elapsed = Math.floor((now - start) / 1000);
  const remaining = Math.max(0, durationSeconds - elapsed);
  const over = remaining === 0;
  const low = remaining <= 15 && !over;
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");

  const bg = over
    ? "var(--md-sys-color-error-container)"
    : low
      ? "var(--md-sys-color-error-container)"
      : "var(--md-sys-color-surface-variant)";
  const fg = over || low ? "var(--md-sys-color-on-error-container)" : "var(--md-sys-color-on-surface-variant)";

  return (
    <span
      title={t(lang, "discussionTime")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 13,
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        animation: low ? "pulseGlow 1.2s ease-in-out infinite" : "none",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{over ? "timer_off" : "timer"}</span>
      {over ? t(lang, "timeUp") : `${mm}:${ss}`}
    </span>
  );
}
