import React from "react";
import { Card } from "./Card";
import { Button } from "./Button";

/**
 * Custom-Modal statt window.confirm – für bessere UX und konsistentes Design.
 */
export function ConfirmModal({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(255, 255, 255, 0.86)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <Card
        style={{
          maxWidth: 420,
          width: "100%",
          padding: "32px 28px 26px",
          background: "var(--md-sys-color-surface)",
          border: "1px solid var(--md-sys-color-outline)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-3)",
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 500, color: "var(--md-sys-color-on-surface)" }}>
          {title}
        </h3>
        <p style={{ margin: "0 0 26px", color: "var(--md-sys-color-on-surface-variant)", lineHeight: 1.6 }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Button variant="text" onClick={onCancel}>
            {cancelLabel ?? "Abbrechen"}
          </Button>
          <Button onClick={onConfirm}>
            {confirmLabel ?? "Bestätigen"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
