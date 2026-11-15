"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { useChartSize } from "@/components/ui/useChartSize";
import {
  AsiaOutlineIcon,
  EuropeOutlineIcon,
  UsOutlineIcon,
} from "@/components/ui/Icons";
import type { ApiError, EtfData } from "@/types";
import type { EtfConfig } from "@/lib/etf";
import { calcPctChange } from "@/lib/utils";

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

interface Market {
  timeZone: string;
  /** Regular session in minutes after midnight, exchange time. */
  open: number;
  close: number;
}

function marketFor(symbol: string): Market {
  const normalized = symbol.toUpperCase();
  if (normalized.endsWith(".L")) {
    return { timeZone: "Europe/London", open: 8 * 60, close: 16 * 60 + 30 };
  }
  if (normalized.endsWith(".DE")) {
    return { timeZone: "Europe/Berlin", open: 9 * 60, close: 17 * 60 + 30 };
  }
  return { timeZone: "America/New_York", open: 9 * 60 + 30, close: 16 * 60 };
}

function isWithinTradingHours(market: Market, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: market.timeZone,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);

  const weekday = parts.find((part) => part.type === "weekday")?.value;
  if (weekday === "Sat" || weekday === "Sun") {
    return false;
  }

  // "24" is how some engines print midnight with hour12: false.
  const hour = Number(parts.find((part) => part.type === "hour")?.value) % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= market.open && totalMinutes < market.close;
}

/** Today's calendar date (YYYY-MM-DD) at the exchange. */
function marketToday(market: Market, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: market.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function formatCloseDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date);
  const day = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(date);
  return { weekday, day };
}

function pctColor(value: number) {
  return value > 0
    ? "text-[color:var(--success)]"
    : value < 0
      ? "text-[color:var(--danger)]"
      : "theme-muted";
}

const RECENT_CLOSE_ROWS = 5;

function getYearTicks(history: EtfData["history"]) {
  if (history.length === 0) {
    return [];
  }

  const years = history.map((point) => Number(point.date.slice(0, 4)));
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const ticks: string[] = [];
  for (let year = minYear; year <= maxYear; year += 1) {
    const firstInYear = history.find((point) => Number(point.date.slice(0, 4)) === year);
    if (firstInYear) {
      ticks.push(firstInYear.date);
    }
  }

  return ticks;
}

function getMonthTicks(history: EtfData["history"]) {
  // The YTD series is led by the previous year's last close; it gets no tick of its own.
  const year = history[history.length - 1]?.date.slice(0, 4);
  return history
    .filter((point, index) => {
      if (point.date.slice(0, 4) !== year) return false;
      return point.date.slice(0, 7) !== history[index - 1]?.date.slice(0, 7);
    })
    .map((point) => point.date);
}

function formatYearTick(value: string) {
  return new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function renderTooltip(currency: string) {
  return function TooltipContent({ active, label, payload }: TooltipContentProps) {

    if (!active || !payload?.length) {
      return null;
    }

    const point = payload[0]?.payload;
    const value = payload[0]?.value;

    if (typeof value !== "number" || !point?.date) {
      return null;
    }

    return (
      <div className="theme-tooltip rounded-xl px-3 py-2">
        <p className="theme-muted text-xs font-medium">
          {formatTooltipDate(String(label ?? point.date))}
        </p>
        <p className="theme-text mt-1 text-sm font-semibold">
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
  const [setChartContainerElement, chartSize] = useChartSize();
  const [selectedRange, setSelectedRange] = useState<"ytd" | "5y" | "max">("ytd");

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
        <p className="theme-muted text-sm">Loading ETF data...</p>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card title={etf.displayName} subtitle={etf.name} icon={getRegionIcon(etf.region)}>
        <p className="text-sm text-[color:var(--danger)]">{error?.message ?? "Failed to load ETF data"}</p>
      </Card>
    );
  }

  // Get history based on selected range
  const getHistoryForRange = (range: "ytd" | "5y" | "max"): EtfData["history"] => {
    if (range === "ytd") {
      return data.history;
    }

    const now = new Date();
    let startDate: string;

    if (range === "5y") {
      const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      startDate = fiveYearsAgo.toISOString().slice(0, 10);
    } else {
      // "max" - return all history
      return data.fullHistory;
    }

    return data.fullHistory.filter((point) => point.date >= startDate);
  };

  // Calculate period change
  const calculatePeriodChange = (history: EtfData["history"]): number => {
    if (history.length < 2) return 0;
    const first = history[0].price;
    const last = history[history.length - 1].price;
    return calcPctChange(last, first);
  };

  const chartHistory = getHistoryForRange(selectedRange);
  const periodChangePct = calculatePeriodChange(chartHistory);
  const periodChangeColor = pctColor(periodChangePct);
  const changeColor = pctColor(data.dailyChangePct);
  const ticks = selectedRange === "ytd" ? getMonthTicks(chartHistory) : getYearTicks(chartHistory);
  const tickFormatter = selectedRange === "ytd" ? formatMonthTick : formatYearTick;
  const lineType: "linear" | "monotone" = "monotone";
  const market = marketFor(data.symbol);
  const inTradingHours = isWithinTradingHours(market);
  const showDailyChange = selectedRange === "ytd" && inTradingHours;
  // While the market is open the newest row is today's running price, not a close.
  const recentCloses = (
    inTradingHours && data.recentCloses[0]?.date === marketToday(market)
      ? data.recentCloses.slice(1)
      : data.recentCloses
  ).slice(0, RECENT_CLOSE_ROWS);
  const chartColor = inTradingHours
    ? periodChangePct > 0
      ? "var(--success)"
      : periodChangePct < 0
        ? "var(--danger)"
        : "var(--subtle)"
    : "var(--muted)";
  const firstHistoryPrice = chartHistory[0]?.price;
  const referenceLineColor = "var(--muted)";

  return (
    <Card title={etf.displayName} subtitle={data.name} icon={getRegionIcon(etf.region)}>
      <div className="space-y-3">
        <div>
          <p className="theme-muted text-xs">As of {formatAsOf(data.asOf)}</p>
          <div className="theme-toggle mt-2 inline-flex items-center rounded-full p-1" role="tablist">
            {(["max", "5y", "ytd"] as const).map((range) => (
              <button
                key={range}
                type="button"
                role="tab"
                aria-selected={selectedRange === range}
                onClick={() => setSelectedRange(range)}
                className={`theme-toggle-option rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
                  selectedRange === range ? "theme-toggle-option-active" : ""
                }`}
              >
                {range === "ytd" ? "YTD" : range === "5y" ? "5Y" : "Max"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="theme-text text-3xl font-semibold tracking-tight">
              {formatCurrency(data.price, data.currency)}
            </p>
            {showDailyChange ? (
              <p className={`text-sm font-medium ${changeColor}`}>
                {formatPct(data.dailyChangePct)} today
              </p>
            ) : null}
          </div>

          <div className={`text-right ${periodChangeColor}`}>
            <p className="theme-muted text-[11px] font-semibold uppercase tracking-[0.18em]">
              {selectedRange === "ytd" ? "YTD" : selectedRange === "5y" ? "5Y" : "Max"}
            </p>
            <p className="text-2xl font-semibold leading-none">
              {formatPct(periodChangePct)}
            </p>
          </div>
        </div>

        <div ref={setChartContainerElement} className="h-32 w-full min-w-0">
          {chartSize.width > 0 && chartSize.height > 0 ? (
            <ComposedChart
              width={chartSize.width}
              height={chartSize.height}
              data={chartHistory}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
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
              <CartesianGrid stroke="var(--grid)" strokeDasharray="3 4" vertical={false} />
              {firstHistoryPrice !== undefined ? (
                <ReferenceLine
                  y={firstHistoryPrice}
                  stroke={referenceLineColor}
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                />
              ) : null}
                <YAxis
                  hide
                  domain={[
                    (dataMin: number) => dataMin - Math.max(Math.abs(dataMin) * 0.01, 0.5),
                    (dataMax: number) => dataMax + Math.max(Math.abs(dataMax) * 0.01, 0.5),
                  ]}
                />
              <XAxis
                dataKey="date"
                ticks={ticks}
                tickFormatter={tickFormatter}
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
                minTickGap={18}
                interval="preserveStartEnd"
              />
              <Tooltip
                cursor={{ stroke: "var(--grid)", strokeDasharray: "3 3" }}
                content={renderTooltip(data.currency)}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="none"
                fill={`url(#etf-fill-${etf.isin})`}
              />
              <Line
                type={lineType}
                dataKey="price"
                stroke={chartColor}
                strokeWidth={2.8}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--surface-strong)", strokeWidth: 1.5 }}
                style={{ filter: `url(#etf-line-glow-${etf.isin})` }}
              />
            </ComposedChart>
          ) : null}
        </div>

        {recentCloses.length > 0 ? (
          <div>
            <p className="theme-muted text-[11px] font-semibold uppercase tracking-[0.14em]">
              Last closes
            </p>
            <table className="mt-1.5 w-full text-sm tabular-nums">
              <tbody>
                {recentCloses.map((close) => {
                  const { weekday, day } = formatCloseDay(close.date);
                  return (
                    <tr key={close.date}>
                      <td className="theme-muted py-0.5 text-xs">
                        <span className="inline-block w-8">{weekday}</span>
                        {day}
                      </td>
                      <td className="theme-text py-0.5 text-right font-medium">
                        {formatCurrency(close.price, data.currency)}
                      </td>
                      <td className={`w-[4.5rem] py-0.5 text-right text-xs font-semibold ${pctColor(close.changePct)}`}>
                        {formatPct(close.changePct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {data.yearlyPerformance.length > 0 ? (
          <div>
            <p
              className="theme-muted flex items-baseline justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
              title="Change in price from one year-end close to the next. Distributions are not included."
            >
              Calendar years
              <span className="theme-subtle font-medium normal-case tracking-normal">price return</span>
            </p>
            <ul
              className="mt-1.5 grid gap-1 tabular-nums"
              style={{ gridTemplateColumns: `repeat(${data.yearlyPerformance.length}, minmax(0, 1fr))` }}
            >
              {data.yearlyPerformance.map(({ year, changePct }) => (
                <li key={year} className="theme-panel rounded-lg px-1 py-1.5 text-center">
                  <p className="theme-muted text-[11px] leading-none">{year}</p>
                  <p className={`mt-1 text-xs font-semibold leading-none ${pctColor(changePct)}`}>
                    {changePct > 0 ? "+" : ""}
                    {changePct.toFixed(1)}%
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
