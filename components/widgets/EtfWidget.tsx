"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("de-DE", { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("de-DE", { month: "short" })
    .format(date)
    .replace(/\.$/, "");
  const year = new Intl.DateTimeFormat("de-DE", { year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${day}. ${month} ${year} at ${time}`;
}

function formatTooltipDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatMonthTick(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function getDateTimePartsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);

  return { weekday, hour, minute };
}

function isWithinTradingHours(symbol: string, now = new Date()) {
  const normalized = symbol.toUpperCase();

  if (normalized.endsWith(".L")) {
    const { weekday, hour, minute } = getDateTimePartsInZone(now, "Europe/London");
    if (weekday === "Sat" || weekday === "Sun") {
      return false;
    }

    const totalMinutes = hour * 60 + minute;
    return totalMinutes >= 8 * 60 && totalMinutes < 16 * 60 + 30;
  }

  if (normalized.endsWith(".DE")) {
    const { weekday, hour, minute } = getDateTimePartsInZone(now, "Europe/Berlin");
    if (weekday === "Sat" || weekday === "Sun") {
      return false;
    }

    const totalMinutes = hour * 60 + minute;
    return totalMinutes >= 9 * 60 && totalMinutes < 17 * 60 + 30;
  }

  const { weekday, hour, minute } = getDateTimePartsInZone(now, "America/New_York");
  if (weekday === "Sat" || weekday === "Sun") {
    return false;
  }

  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= 9 * 60 + 30 && totalMinutes < 16 * 60;
}

function getMonthTicks(history: EtfData["history"]) {
  return history.filter((point, index) => {
    const previousMonth = history[index - 1]?.date.slice(0, 7);
    return index === 0 || point.date.slice(0, 7) !== previousMonth;
  }).map((point) => point.date);
}

function renderTooltip(currency: string) {
  return function TooltipContent(props: any) {
    const {
      active,
      label,
      payload,
    }: {
      active?: boolean;
      label?: string | number;
      payload?: ReadonlyArray<{ value?: number; payload?: { date?: string } }>;
    } = props;

    if (!active || !payload?.length) {
      return null;
    }

    const point = payload[0]?.payload;
    const value = payload[0]?.value;

    if (typeof value !== "number" || !point?.date) {
      return null;
    }

    return (
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
        <p className="text-xs font-medium text-slate-500">
          {formatTooltipDate(String(label ?? point.date))}
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">
          {formatCurrency(value, currency)}
        </p>
      </div>
    );
  };
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
  const ytdColor =
    data.ytdChangePct > 0
      ? "text-emerald-600"
      : data.ytdChangePct < 0
        ? "text-rose-600"
        : "text-slate-500";
  const monthTicks = getMonthTicks(data.history);
  const showDailyChange = isWithinTradingHours(data.symbol);
  const chartColor = showDailyChange
    ? data.trend === "down"
      ? "#dc2626"
      : data.trend === "up"
        ? "#16a34a"
        : "#64748b"
    : "#94a3b8";

  return (
    <Card title={etf.displayName} subtitle={data.name} icon={getRegionIcon(etf.region)}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">As of {formatAsOf(data.asOf)}</p>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="text-3xl font-semibold tracking-tight text-slate-900">
              {formatCurrency(data.price, data.currency)}
            </p>
            {showDailyChange ? (
              <p className={`text-sm font-medium ${changeColor}`}>
                {formatPct(data.dailyChangePct)} today
              </p>
            ) : null}
          </div>

          <div className={`text-right ${ytdColor}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              YTD
            </p>
            <p className="text-2xl font-semibold leading-none">
              {formatPct(data.ytdChangePct)}
            </p>
          </div>
        </div>

        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.history} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`etf-fill-${etf.isin}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="4%" stopColor={chartColor} stopOpacity={0.38} />
                  <stop offset="70%" stopColor={chartColor} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0.02} />
                </linearGradient>
                <filter id={`etf-line-glow-${etf.isin}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow
                    dx="0"
                    dy="1"
                    stdDeviation="1.6"
                    floodColor={chartColor}
                    floodOpacity="0.35"
                  />
                </filter>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 4" vertical={false} />
                <YAxis
                  hide
                  domain={[
                    (dataMin: number) => dataMin - Math.max(Math.abs(dataMin) * 0.01, 0.5),
                    (dataMax: number) => dataMax + Math.max(Math.abs(dataMax) * 0.01, 0.5),
                  ]}
                />
              <XAxis
                dataKey="date"
                ticks={monthTicks}
                tickFormatter={formatMonthTick}
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                minTickGap={18}
                interval="preserveStartEnd"
              />
              <Tooltip
                cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }}
                content={renderTooltip(data.currency)}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="none"
                fill={`url(#etf-fill-${etf.isin})`}
              />
              <Line
                type="monotone"
                dataKey="price"
                  stroke={chartColor}
                strokeWidth={2.8}
                dot={false}
                activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 1.5 }}
                style={{ filter: `url(#etf-line-glow-${etf.isin})` }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
