import React from "react";

export function Card({ children, className = "", variant = "elevated", elevated = true, style = {}, ...rest }) {
  const isOutlined = variant === "outlined";
  const isFilled = variant === "filled";

  let background = "var(--md-sys-color-surface)";
  let border = "1px solid transparent";
  let boxShadow = "var(--shadow-2)";

  if (isOutlined) {
    background = "var(--md-sys-color-surface)";
    border = "1px solid transparent";
    boxShadow = "none";
  } else if (isFilled) {
    background = "var(--md-sys-color-surface)";
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
        borderRadius: "var(--radius-xl)",
        border,
        boxShadow,
        overflow: "hidden",
        transition: "box-shadow 220ms var(--motion-standard), border-color 220ms var(--motion-standard), background-color 220ms var(--motion-standard), transform 220ms var(--motion-standard)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
