"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { MacroIcon } from "@/components/ui/Icons";
import type { ApiError, MacroData } from "@/types";

function formatValue(value: number, unit: string) {
  if (unit === "%") {
    return `${value.toFixed(2)}${unit}`;
  }

  return `${value.toFixed(2)} ${unit}`;
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
      <Card title="Macro" subtitle="Inflation & Rates" icon={<MacroIcon className="h-5 w-5" />}>
        <p className="theme-muted text-sm">Loading macro indicators...</p>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card title="Macro" subtitle="Inflation & Rates" icon={<MacroIcon className="h-5 w-5" />}>
        <p className="text-sm text-[color:var(--danger)]">
          {error?.message ?? "Failed to load macro indicators"}
        </p>
      </Card>
    );
  }

  return (
    <Card title="Macro" subtitle={`Sources: ${data.sources.join(", ")}`} icon={<MacroIcon className="h-5 w-5" />}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.indicators.map((indicator) => {
          const change = indicator.change ?? 0;
          const changeColor =
            change > 0
              ? "text-[color:var(--success)]"
              : change < 0
                ? "text-[color:var(--danger)]"
                : "theme-muted";

          return (
            <div
              key={indicator.label}
              className="theme-panel rounded-xl p-3"
            >
              <p className="theme-muted text-xs">{indicator.label}</p>
              <p className="theme-text text-2xl font-semibold">
                {formatValue(indicator.value, indicator.unit)}
              </p>
              <p className={`text-xs ${changeColor}`}>
                {change > 0 ? "+" : ""}
                {change.toFixed(2)} {indicator.unit} vs previous
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
