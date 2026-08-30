"use client";

import { useMemo } from "react";

const SYMBOLS = ["💵", "💰", "৳", "$", "💸", "🪙", "💴", "🤑"];

export default function FlyingMoney() {
  const particles = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        left: `${(i * 2.8 + (i % 7) * 11) % 100}%`,
        delay: `${(i * 0.45) % 12}s`,
        duration: `${8 + (i % 8) * 1.2}s`,
        size: 16 + (i % 5) * 7,
        symbol: SYMBOLS[i % SYMBOLS.length],
        opacity: 0.35 + (i % 4) * 0.1,
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.id}
          className="animate-float-money absolute select-none"
          style={{
            left: p.left,
            top: "-10%",
            fontSize: p.size,
            opacity: p.opacity,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        >
          {p.symbol}
        </span>
      ))}
    </div>
  );
}
