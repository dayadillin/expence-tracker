export default function RainbowGradientDefs() {
  return (
    <svg aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-hidden">
      <defs>
        <linearGradient id="app-rainbow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="22%" stopColor="#06b6d4" />
          <stop offset="45%" stopColor="#3b82f6" />
          <stop offset="68%" stopColor="#8b5cf6" />
          <stop offset="85%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
    </svg>
  );
}
