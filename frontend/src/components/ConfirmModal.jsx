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
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <Card style={{ maxWidth: 400, width: "100%", padding: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 20, color: "var(--md-sys-color-on-surface)" }}>
          {title}
        </h3>
        <p style={{ margin: "0 0 24px", color: "var(--md-sys-color-on-surface-variant)", lineHeight: 1.5 }}>
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
