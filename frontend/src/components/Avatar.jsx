import React from "react";

const COLORS = [
  { bg: "var(--md-sys-color-primary)", color: "var(--md-sys-color-on-primary)" },
  { bg: "var(--md-sys-color-secondary)", color: "var(--md-sys-color-on-secondary)" },
  { bg: "var(--md-sys-color-tertiary)", color: "var(--md-sys-color-on-tertiary)" },
  { bg: "var(--md-sys-color-primary-container)", color: "var(--md-sys-color-on-primary-container)" },
  { bg: "var(--md-sys-color-secondary-container)", color: "var(--md-sys-color-on-secondary-container)" },
  { bg: "var(--md-sys-color-tertiary-container)", color: "var(--md-sys-color-on-tertiary-container)" },
];

export function Avatar({ name, size = 40, style = {} }) {
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  const idx = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length;
  const { bg, color } = COLORS[idx];

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color,
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size <= 32 ? 14 : size <= 48 ? 18 : 22,
        fontWeight: 500,
        flexShrink: 0,
        boxShadow: "var(--shadow-1)",
        ...style,
      }}
      aria-hidden
    >
      {letter}
    </div>
  );
}
