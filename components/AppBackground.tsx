"use client";

import FlyingMoney from "./FlyingMoney";

export default function AppBackground({ moneyRain = true }: { moneyRain?: boolean }) {
  return (
    <>
      <div className="app-ambient-mesh pointer-events-none fixed inset-0 z-0" aria-hidden />
      {moneyRain && <FlyingMoney />}
    </>
  );
}
