"use client";

import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/Card";
import {
  AsiaOutlineIcon,
  EuropeOutlineIcon,
  UsOutlineIcon,
} from "@/components/ui/Icons";
import type { ApiError, EtfData } from "@/types";
import type { EtfConfig } from "@/lib/etf";

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

function formatAsOf(value: string) {
  return new Intl.DateTimeFormat("en-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getRegionIcon(region: EtfConfig["region"]) {
  switch (region) {
    case "us":
      return <UsOutlineIcon className="h-5 w-5" />;
    case "europe":
      return <EuropeOutlineIcon className="h-5 w-5" />;
    case "asia":
      return <AsiaOutlineIcon className="h-5 w-5" />;
  }
}

interface EtfWidgetProps {
  etf: EtfConfig;
}

export function EtfWidget({ etf }: EtfWidgetProps) {
  const { data, isLoading, isError, error } = useQuery<EtfData, Error>({
    queryKey: ["etf", etf.isin],
    queryFn: async () => {
      const response = await fetch(`/api/etf?isin=${encodeURIComponent(etf.isin)}`);
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
      <Card title={etf.displayName} subtitle={etf.name} icon={getRegionIcon(etf.region)}>
        <p className="text-sm text-slate-500">Loading ETF data...</p>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card title={etf.displayName} subtitle={etf.name} icon={getRegionIcon(etf.region)}>
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
    <Card title={etf.displayName} subtitle={data.name} icon={getRegionIcon(etf.region)}>
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-semibold text-slate-900">
              {formatCurrency(data.price, data.currency)}
            </p>
            <p className={`text-sm font-medium ${changeColor}`}>
              {formatPct(data.dailyChangePct)} today · {formatPct(data.ytdChangePct)} ytd
            </p>
          </div>
          <p className="text-xs text-slate-400">{data.symbol}</p>
        </div>

        <p className="text-xs text-slate-500">
          As of {formatAsOf(data.asOf)}
        </p>

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
