import React, { useState } from "react";

export function Input({ label, value, onChange, type = "text", placeholder, ...rest }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: isFocused ? "var(--md-sys-color-primary)" : "var(--md-sys-color-on-surface-variant)",
            marginBottom: 6,
            paddingLeft: 2,
            transition: "color 0.2s",
            letterSpacing: "-0.01em",
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        <input
          type={inputType}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: "14px 16px",
            paddingRight: isPassword ? 48 : 16,
            border: `2px solid ${isFocused ? "var(--md-sys-color-primary)" : "var(--md-sys-color-outline-variant)"}`,
            borderRadius: "var(--radius)",
            background: isFocused ? "var(--md-sys-color-surface)" : "var(--md-sys-color-surface-container-low)",
            fontFamily: "inherit",
            fontSize: 16,
            color: "var(--md-sys-color-on-surface)",
            outline: "none",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: isFocused ? "0 4px 6px -1px rgb(0 0 0 / 0.05)" : "none",
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              width: 36,
              height: 36,
              borderRadius: "var(--radius)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: isFocused ? "var(--md-sys-color-primary)" : "var(--md-sys-color-on-surface-variant)",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
            aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
