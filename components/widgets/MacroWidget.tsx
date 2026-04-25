"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { MacroIcon } from "@/components/ui/Icons";
import type { ApiError, MacroData } from "@/types";

function formatValue(value: number, unit: string) {
  if (unit === "$") {
    return `$${value.toFixed(2)}`;
  }

  if (unit === "rate") {
    return value.toFixed(4);
  }

  if (unit === "%") {
    return `${value.toFixed(2)}${unit}`;
  }

  if (unit === "idx") {
    return value.toFixed(1);
  }

  if (unit === "pp") {
    return `${value.toFixed(2)} pp`;
  }

  return `${value.toFixed(2)} ${unit}`;
}

function formatChange(change: number, unit: string) {
  if (unit === "$") {
    return `${change > 0 ? "+" : ""}$${change.toFixed(2)} vs previous`;
  }

  if (unit === "rate") {
    return `${change > 0 ? "+" : ""}${change.toFixed(4)} vs previous`;
  }

  if (unit === "%") {
    return `${change > 0 ? "+" : ""}${change.toFixed(2)} pp vs previous`;
  }

  if (unit === "idx") {
    return `${change > 0 ? "+" : ""}${change.toFixed(1)} vs previous`;
  }

  if (unit === "pp") {
    return `${change > 0 ? "+" : ""}${change.toFixed(2)} pp vs previous`;
  }

  return `${change > 0 ? "+" : ""}${change.toFixed(2)} ${unit} vs previous`;
}

export function MacroWidget() {
  const { data, isLoading, isError, error } = useQuery<MacroData, Error>({
    queryKey: ["macro"],
    queryFn: async () => {
      const response = await fetch("/api/macro");
      const payload = (await response.json()) as MacroData | ApiError;

      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error : "Macro request failed",
        );
      }

      return payload as MacroData;
    },
  });

  if (isLoading) {
    return (
      <Card title="Macro & Markets" subtitle="Daily pulse + structural context" icon={<MacroIcon className="h-5 w-5" />}>
        <p className="theme-muted text-sm">Loading macro indicators...</p>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card title="Macro & Markets" subtitle="Daily pulse + structural context" icon={<MacroIcon className="h-5 w-5" />}>
        <p className="text-sm text-[color:var(--danger)]">
          {error?.message ?? "Failed to load macro indicators"}
        </p>
      </Card>
    );
  }

  return (
    <Card title="Macro & Markets" subtitle={`Sources: ${data.sources.join(", ")}`} icon={<MacroIcon className="h-5 w-5" />}>
      <div className="space-y-4">
        <section>
          <header className="mb-2 flex items-center justify-between">
            <p className="theme-text text-xs font-semibold uppercase tracking-[0.14em]">
              Markets Today
            </p>
            <p className="theme-muted text-xs">High-frequency indicators</p>
          </header>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.marketsToday.map((indicator) => {
              const change = indicator.change ?? 0;
              const changeColor =
                change > 0
                  ? "text-[color:var(--success)]"
                  : change < 0
                    ? "text-[color:var(--danger)]"
                    : "theme-muted";

              return (
                <div
                  key={indicator.id}
                  className="theme-panel rounded-xl border-[color:var(--accent-soft)] p-3"
                >
                  <p className="theme-muted text-xs">{indicator.label}</p>
                  <p className="theme-text mt-1 text-2xl font-semibold">
                    {formatValue(indicator.value, indicator.unit)}
                  </p>
                  <p className={`mt-1 text-xs ${changeColor}`}>
                    {formatChange(change, indicator.unit)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <header className="mb-2 flex items-center justify-between">
            <p className="theme-text text-xs font-semibold uppercase tracking-[0.14em]">
              Macro Environment
            </p>
            <p className="theme-muted text-xs">Slow-moving backdrop</p>
          </header>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.macroEnvironment.map((indicator) => {
              const change = indicator.change ?? 0;
              const changeColor =
                change > 0
                  ? "text-[color:var(--success)]"
                  : change < 0
                    ? "text-[color:var(--danger)]"
                    : "theme-muted";

              return (
                <div
                  key={indicator.id}
                  className="theme-panel rounded-xl p-3"
                >
                  <p className="theme-muted text-xs">{indicator.label}</p>
                  <p className="theme-text text-xl font-semibold">
                    {formatValue(indicator.value, indicator.unit)}
                  </p>
                  <p className={`text-xs ${changeColor}`}>
                    {formatChange(change, indicator.unit)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Card>
  );
}
