import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "./Button";
import { t } from "../i18n/translations";

/**
 * Vollbild-Modal mit einem großen QR-Code zum Beitreten.
 * Ideal am Tisch: Handy hochhalten, Mitspieler scannen, fertig.
 */
export function QrModal({ open, url, lang, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fade-in"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1500,
        padding: 24,
      }}
    >
      <div
        className="pop-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 360,
          width: "100%",
          padding: 28,
          borderRadius: "var(--radius-xl)",
          background: "var(--md-sys-color-surface)",
          boxShadow: "var(--shadow-3)",
          textAlign: "center",
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "var(--md-sys-color-on-surface)" }}>
          {t(lang, "scanToJoin")}
        </h3>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--md-sys-color-on-surface-variant)", wordBreak: "break-all" }}>
          {url}
        </p>
        <div
          style={{
            display: "inline-flex",
            padding: 18,
            borderRadius: 24,
            background: "#ffffff",
            // Verlauf in Google-Farben als Rahmen.
            boxShadow: "0 0 0 4px transparent",
            backgroundImage:
              "linear-gradient(#fff, #fff), linear-gradient(135deg, var(--g-blue), var(--g-green), var(--g-yellow), var(--g-red))",
            backgroundOrigin: "border-box",
            backgroundClip: "content-box, border-box",
            border: "4px solid transparent",
            marginBottom: 24,
          }}
        >
          <QRCodeSVG value={url || ""} size={208} level="M" marginSize={0} fgColor="#1a1b1f" bgColor="#ffffff" />
        </div>
        <Button fullWidth onClick={onClose} style={{ padding: "14px" }}>
          {t(lang, "closeLabel")}
        </Button>
      </div>
    </div>
  );
}
