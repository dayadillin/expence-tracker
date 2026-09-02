"use client";

import { Home, PlusCircle, Clock, BookOpen, Target } from "lucide-react";

const NAV = [
  { id: "home", label: "Home", icon: Home },
  { id: "expense-hub", label: "Add", icon: PlusCircle, match: ["expense-hub", "add-money", "add-expense"] },
  { id: "history", label: "Ledger", icon: Clock },
  { id: "tuition", label: "Tuition", icon: BookOpen },
] as const;

export default function BottomNav({
  activeTab,
  onTabChange,
  onBudget,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onBudget: () => void;
}) {
  const isActive = (item: (typeof NAV)[number]) =>
    "match" in item ? (item.match as readonly string[]).includes(activeTab) : activeTab === item.id;

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div className="nav-dock flex items-center justify-around rounded-2xl border px-1 py-1.5">
        {NAV.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative flex flex-col items-center rounded-xl px-3 py-2 transition-all duration-300 ${
                active
                  ? "nav-item-active text-green-600 dark:text-green-400"
                  : "text-gray-400 hover:text-green-600 dark:hover:text-green-400"
              }`}
            >
              {active && (
                <span className="absolute -top-0.5 h-1 w-6 rounded-full bg-green-500 dark:bg-green-400 animate-scale-in" />
              )}
              <Icon size={20} className={`mb-0.5 ${active ? "drop-shadow-sm" : ""}`} />
              <span className={`text-[9px] font-medium ${active ? "text-green-600 dark:text-green-400" : ""}`}>{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={onBudget}
          className="flex flex-col items-center rounded-xl px-3 py-2 text-gray-400 transition-all hover:scale-105 hover:text-green-600 dark:hover:text-green-400"
        >
          <Target size={20} className="mb-0.5" />
          <span className="text-[9px] font-medium">Budget</span>
        </button>
      </div>
    </nav>
  );
}
