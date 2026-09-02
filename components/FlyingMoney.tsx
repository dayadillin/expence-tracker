"use client";

import { useMemo } from "react";

const SYMBOLS = ["💵", "💰", "৳", "$", "💸", "🪙", "💴", "🤑", "✨", "💎"];

export default function FlyingMoney() {
  const particles = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        id: i,
        left: `${(i * 2.8 + (i % 7) * 11) % 100}%`,
        delay: `${(i * 0.35) % 10}s`,
        duration: `${7 + (i % 9) * 1.1}s`,
        size: 18 + (i % 6) * 6,
        symbol: SYMBOLS[i % SYMBOLS.length],
        opacity: 0.42 + (i % 5) * 0.08,
      })),
    []
  );

  return (
    <div className="money-rain pointer-events-none fixed inset-0 z-[35] overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.id}
          className="animate-float-money absolute select-none drop-shadow-sm"
          style={{
            left: p.left,
            top: "-12%",
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
