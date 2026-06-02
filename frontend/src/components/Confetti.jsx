import React, { useMemo } from "react";

const COLORS = [
  "var(--g-blue)",
  "var(--g-red)",
  "var(--g-yellow)",
  "var(--g-green)",
  "#7c4dff",
  "#00bcd4",
  "#ff7043",
];

/**
 * Leichtgewichtiges, performantes Konfetti (reines CSS, keine Abhängigkeit).
 * Wird z. B. auf dem Spielende-Screen gezeigt.
 */
export function Confetti({ count = 90 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2.5;
        const duration = 3 + Math.random() * 2.5;
        const size = 7 + Math.random() * 8;
        const drift = (Math.random() - 0.5) * 220;
        const color = COLORS[i % COLORS.length];
        const round = Math.random() > 0.6;
        return { id: i, left, delay, duration, size, drift, color, round };
      }),
    [count]
  );

  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 3000 }}>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}vw`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.4,
            borderRadius: p.round ? "50%" : 2,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            "--confetti-x": `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
