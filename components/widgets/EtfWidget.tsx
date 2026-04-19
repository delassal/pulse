"use client";

import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/Card";
import type { ApiError, EtfData } from "@/types";

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function EtfWidget() {
  const { data, isLoading, isError, error } = useQuery<EtfData, Error>({
    queryKey: ["etf", "vwce.de"],
    queryFn: async () => {
      const response = await fetch("/api/etf");
      const payload = (await response.json()) as EtfData | ApiError;

      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error : "ETF request failed",
        );
      }

      return payload as EtfData;
    },
  });

  if (isLoading) {
    return (
      <Card title="ETF" subtitle="VWCE.DE">
        <p className="text-sm text-slate-500">Loading ETF data...</p>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card title="ETF" subtitle="VWCE.DE">
        <p className="text-sm text-red-600">{error?.message ?? "Failed to load ETF data"}</p>
      </Card>
    );
  }

  const changeColor =
    data.trend === "up"
      ? "text-emerald-600"
      : data.trend === "down"
        ? "text-rose-600"
        : "text-slate-500";

  return (
    <Card title="ETF" subtitle={data.name}>
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-semibold text-slate-900">
              {formatCurrency(data.price, data.currency)}
            </p>
            <p className={`text-sm font-medium ${changeColor}`}>
              {formatPct(data.dailyChangePct)} today
            </p>
          </div>
          <p className="text-xs text-slate-400">{data.symbol}</p>
        </div>

        <div className="h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.history}>
              <Tooltip
                formatter={(value) => formatCurrency(Number(value), data.currency)}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke={data.trend === "down" ? "#dc2626" : "#16a34a"}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
