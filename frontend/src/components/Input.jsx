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
            fontSize: 12,
            fontWeight: 500,
            color: isFocused ? "var(--md-sys-color-primary)" : "var(--md-sys-color-on-surface-variant)",
            marginBottom: 6,
            paddingLeft: 12,
            transition: "color 140ms ease",
            letterSpacing: "0.04em",
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
            padding: "15px 16px 14px",
            paddingRight: isPassword ? 48 : 16,
            border: "1px solid transparent",
            borderRadius: 18,
            background: "var(--md-sys-color-surface)",
            fontFamily: "inherit",
            fontSize: 16,
            color: "var(--md-sys-color-on-surface)",
            outline: "none",
            transition: "border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease",
            boxShadow: isFocused ? "0 0 0 2px color-mix(in srgb, var(--md-sys-color-primary) 14%, white), var(--shadow-1)" : "var(--shadow-1)",
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
              borderRadius: 18,
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
            aria-label={showPassword ? "Passwort ausblenden" : "Passwort einblenden"}
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
