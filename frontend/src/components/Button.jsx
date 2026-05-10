import React from "react";

const variants = {
  filled: {
    background: "var(--md-sys-color-primary)",
    color: "var(--md-sys-color-on-primary)",
    border: "1px solid transparent",
  },
  tonal: {
    background: "var(--md-sys-color-secondary-container)",
    color: "var(--md-sys-color-on-secondary-container)",
    border: "1px solid transparent",
  },
  outlined: {
    background: "transparent",
    color: "var(--md-sys-color-primary)",
    border: "1px solid var(--md-sys-color-outline)",
  },
  text: {
    background: "transparent",
    color: "var(--md-sys-color-primary)",
    border: "1px solid transparent",
  },
  danger: {
    background: "var(--md-sys-color-error)",
    color: "var(--md-sys-color-on-error)",
    border: "1px solid transparent",
  },
};

export function Button({
  children,
  variant = "filled",
  fullWidth = false,
  small = false,
  className = "",
  style = {},
  disabled = false,
  ...rest
}) {
  const resolved = variant === "ghost" ? "tonal" : variant === "secondary" ? "outlined" : variant;
  const v = variants[resolved] ?? variants.filled;

  return (
    <button
      type={rest.type || "button"}
      className={`md-state-layer ${className}`.trim()}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: small ? "8px 16px" : "12px 26px",
        minHeight: small ? 40 : "var(--touch)",
        border: disabled ? "1px solid transparent" : v.border,
        borderRadius: 999,
        background: disabled ? "var(--md-sys-color-surface-container-high)" : v.background,
        color: disabled ? "var(--md-sys-color-on-surface-variant)" : v.color,
        fontFamily: "inherit",
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: "0.01em",
        cursor: disabled ? "not-allowed" : "pointer",
        width: fullWidth ? "100%" : undefined,
        transition: "background-color 160ms var(--motion-standard), color 160ms var(--motion-standard), border-color 160ms var(--motion-standard), box-shadow 220ms var(--motion-standard), transform 160ms var(--motion-standard)",
        boxShadow: disabled
          ? "none"
          : resolved === "filled"
            ? "var(--shadow-2)"
            : resolved === "tonal"
              ? "var(--shadow-1)"
              : "var(--shadow-1)",
        transform: disabled ? "none" : "translateY(0)",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
