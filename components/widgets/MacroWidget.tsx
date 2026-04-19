"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
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
      <Card title="Macro" subtitle="Inflation & Rates">
        <p className="text-sm text-slate-500">Loading macro indicators...</p>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card title="Macro" subtitle="Inflation & Rates">
        <p className="text-sm text-red-600">
          {error?.message ?? "Failed to load macro indicators"}
        </p>
      </Card>
    );
  }

  return (
    <Card title="Macro" subtitle={`Sources: ${data.sources.join(", ")}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.indicators.map((indicator) => {
          const change = indicator.change ?? 0;
          const changeColor =
            change > 0
              ? "text-emerald-600"
              : change < 0
                ? "text-rose-600"
                : "text-slate-500";

          return (
            <div
              key={indicator.label}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <p className="text-xs text-slate-500">{indicator.label}</p>
              <p className="text-2xl font-semibold text-slate-900">
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
