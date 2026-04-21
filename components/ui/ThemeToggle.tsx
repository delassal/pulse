"use client";

import { useTheme, type ThemePreference } from "@/components/theme/ThemeProvider";

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-toggle inline-flex items-center rounded-full p-1">
      {OPTIONS.map((option) => {
        const isActive = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => setTheme(option.value)}
            className={`theme-toggle-option rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide ${
              isActive ? "theme-toggle-option-active" : ""
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}