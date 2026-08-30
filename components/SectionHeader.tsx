"use client";

import { ChevronLeft } from "lucide-react";

export default function SectionHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  return (
    <div className="animate-fade-up mb-4 flex items-center gap-3">
      {onBack && (
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-green-200 bg-white text-green-600 shadow-sm transition-all hover:scale-105 hover:bg-green-50 active:scale-95"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}
