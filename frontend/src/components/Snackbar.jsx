import React from "react";

export function Snackbar({ message, open, tone = "default" }) {
  if (!open || !message) return null;

  const toneStyles =
    tone === "error"
      ? {
          background: "var(--md-sys-color-error-container)",
          color: "var(--md-sys-color-on-error-container)",
          border: "1px solid color-mix(in srgb, var(--md-sys-color-error) 40%, white)",
        }
      : {
          background: "var(--md-sys-color-surface)",
          color: "var(--md-sys-color-on-surface)",
          border: "1px solid var(--md-sys-color-outline)",
        };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "max(20px, var(--safe-bottom))",
        transform: "translateX(-50%)",
        width: "min(92vw, 560px)",
        padding: "12px 16px",
        borderRadius: 18,
        boxShadow: "var(--shadow-2)",
        zIndex: 2000,
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: "0.01em",
        ...toneStyles,
      }}
    >
      {message}
    </div>
  );
}
