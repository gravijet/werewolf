import React, { useState } from "react";

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
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const resolved = variant === "ghost" ? "tonal" : variant === "secondary" ? "outlined" : variant;
  const v = variants[resolved] ?? variants.filled;

  // Modern hover effects
  let currentBg = v.background;
  let currentColor = v.color;
  let currentBorder = v.border;

  if (disabled) {
    currentBg = "var(--md-sys-color-surface-variant)";
    currentColor = "var(--md-sys-color-on-surface-variant)";
    currentBorder = "1px solid transparent";
  } else if (isHovered && resolved === "filled") {
    currentBg = "var(--accent-hover)";
  } else if (isHovered && resolved === "outlined") {
    currentBg = "var(--md-sys-color-surface-variant)";
  } else if (isHovered && resolved === "tonal") {
    currentBg = "var(--md-sys-color-surface-variant)";
  } else if (isHovered && resolved === "text") {
    currentBg = "var(--md-sys-color-surface-variant)";
  }

  return (
    <button
      type={rest.type || "button"}
      className={className}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsActive(false); }}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: small ? "8px 16px" : "12px 24px",
        minHeight: small ? 40 : "var(--touch)",
        border: currentBorder,
        borderRadius: "var(--r-pill)",
        background: currentBg,
        color: currentColor,
        fontFamily: "inherit",
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        cursor: disabled ? "not-allowed" : "pointer",
        width: fullWidth ? "100%" : undefined,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: isActive && !disabled ? "scale(0.97)" : "scale(1)",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
