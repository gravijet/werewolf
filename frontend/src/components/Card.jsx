import React from "react";

export function Card({ children, className = "", variant = "elevated", elevated = true, ...rest }) {
  const isOutlined = variant === "outlined";
  const isFilled = variant === "filled";

  let background = "var(--md-sys-color-surface)";
  let border = "1px solid var(--md-sys-color-outline-variant)";
  let boxShadow = "var(--shadow-1)";

  if (isOutlined) {
    background = "var(--md-sys-color-surface)";
    border = "1px solid var(--md-sys-color-outline-variant)";
    boxShadow = "none";
  } else if (isFilled) {
    background = "var(--md-sys-color-surface-container)";
    border = "1px solid transparent";
    boxShadow = "none";
  } else if (!elevated) {
    boxShadow = "none";
  }

  return (
    <div
      className={`card ${className}`}
      style={{
        background,
        borderRadius: "var(--radius-lg)",
        border,
        boxShadow,
        overflow: "hidden",
        transition: "box-shadow 0.3s ease, transform 0.3s ease",
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
