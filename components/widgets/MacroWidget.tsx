"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { Flag, type FlagCode } from "@/components/ui/Flag";
import { MacroIcon } from "@/components/ui/Icons";
import { calcPctChange } from "@/lib/utils";
import type { ApiError, MacroData, MacroIndicator, MacroRegionContext } from "@/types";

type ChangeBasis = "previous" | "year";
type RegionId = MacroRegionContext["id"];
type MarketRange = "1m" | "6m" | "1y" | "5y";

const MARKET_RANGES: Array<{ id: MarketRange; label: string; months: number }> = [
  { id: "1m", label: "1M", months: 1 },
  { id: "6m", label: "6M", months: 6 },
  { id: "1y", label: "1Y", months: 12 },
  { id: "5y", label: "5Y", months: 60 },
];

const MARKET_EXPLAINERS: Record<string, string> = {
  vix: "Expected 30-day swings of the S&P 500. Below 15 is calm, above 25 signals market stress.",
  eur_usd: "US dollars per euro. Rising means a stronger euro, making US assets and imports cheaper for you.",
  oil_wti: "US crude benchmark in USD per barrel. Feeds into fuel prices and headline inflation.",
  gold: "COMEX futures in USD per troy ounce. A safe haven that tends to rise on uncertainty or falling real rates.",
};

const REGION_FLAGS: Record<RegionId, FlagCode> = {
  eu: "eu",
  uk: "uk",
  us: "us",
  russia: "ru",
  china: "cn",
};

const REGION_SHORT: Record<RegionId, string> = {
  eu: "EU",
  uk: "UK",
  us: "US",
  russia: "RU",
  china: "CN",
};

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

function formatChange(change: number, unit: string, basis: ChangeBasis = "previous") {
  const suffix = basis === "year" ? "vs previous year" : "vs previous";

  if (unit === "$") {
    return `${change > 0 ? "+" : ""}$${change.toFixed(2)} ${suffix}`;
  }

  if (unit === "rate") {
    return `${change > 0 ? "+" : ""}${change.toFixed(4)} ${suffix}`;
  }

  if (unit === "%") {
    return `${change > 0 ? "+" : ""}${change.toFixed(2)} pp ${suffix}`;
  }

  if (unit === "idx") {
    return `${change > 0 ? "+" : ""}${change.toFixed(1)} ${suffix}`;
  }

  if (unit === "pp") {
    return `${change > 0 ? "+" : ""}${change.toFixed(2)} pp ${suffix}`;
  }

  return `${change > 0 ? "+" : ""}${change.toFixed(2)} ${unit} ${suffix}`;
}

function formatPct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function getChangeColor(change: number) {
  return change > 0
    ? "text-[color:var(--success)]"
    : change < 0
      ? "text-[color:var(--danger)]"
      : "theme-muted";
}

function shiftOneYear(dateIso: string) {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

function getYearOverYearChange(
  points: { date: string; inflation: number; policyRate: number }[],
  key: "inflation" | "policyRate",
) {
  const latest = points[points.length - 1];

  if (!latest) {
    return null;
  }

  const targetDate = shiftOneYear(latest.date);
  const pointByDate = new Map(points.map((point) => [point.date, point]));
  const priorYear = pointByDate.get(targetDate);

  if (!priorYear) {
    return null;
  }

  return latest[key] - priorYear[key];
}

function formatYearTick(value: string) {
  return value.slice(0, 4);
}

function formatMonthTick(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatDayTick(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatTooltipMonth(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    year: "numeric",
    month: "long",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTooltipDay(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

// First data point of each period (key length 4 = year, 7 = month), used as axis ticks.
function getPeriodTicks(dates: string[], keyLength: 4 | 7) {
  return dates.filter(
    (date, index) => index === 0 || date.slice(0, keyLength) !== dates[index - 1].slice(0, keyLength),
  );
}

function filterByRange(history: NonNullable<MacroIndicator["history"]>, range: MarketRange) {
  const latest = history[history.length - 1];

  if (!latest) {
    return [];
  }

  const months = MARKET_RANGES.find((option) => option.id === range)?.months ?? 12;
  const start = new Date(`${latest.date}T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - months);
  const startIso = start.toISOString().slice(0, 10);

  return history.filter((point) => point.date >= startIso);
}

function latestHistoryDate(history?: { date: string; value: number }[]) {
  if (!history?.length) {
    return null;
  }

  return history[history.length - 1].date;
}

function formatDataVintage(dateIso: string) {
  return new Intl.DateTimeFormat("de-DE", {
    year: "numeric",
    month: "short",
  }).format(new Date(`${dateIso}T00:00:00`));
}

function getFreshness(latestDate: string | null) {
  if (!latestDate) {
    return {
      text: "no recent datapoint",
      className: "text-[color:var(--danger)]",
    };
  }

  const now = new Date();
  const latest = new Date(`${latestDate}T00:00:00`);
  const diffMs = now.getTime() - latest.getTime();
  const ageDays = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));

  if (ageDays <= 60) {
    return {
      text: `updated ${formatDataVintage(latestDate)}`,
      className: "text-[color:var(--success)]",
    };
  }

  if (ageDays <= 180) {
    return {
      text: `older data (${formatDataVintage(latestDate)})`,
      className: "text-[color:var(--warning)]",
    };
  }

  return {
    text: `stale data (${formatDataVintage(latestDate)})`,
    className: "text-[color:var(--danger)]",
  };
}

// Explicit chart size from a ResizeObserver; see CLAUDE.md on why not <ResponsiveContainer>.
function useChartSize() {
  const [chartContainerElement, setChartContainerElement] = useState<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!chartContainerElement) {
      return;
    }

    const updateSize = () => {
      const { width, height } = chartContainerElement.getBoundingClientRect();
      const nextWidth = Math.max(0, Math.floor(width));
      const nextHeight = Math.max(0, Math.floor(height));

      setChartSize((previous) => {
        if (previous.width === nextWidth && previous.height === nextHeight) {
          return previous;
        }

        return { width: nextWidth, height: nextHeight };
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(chartContainerElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [chartContainerElement]);

  return [setChartContainerElement, chartSize] as const;
}

function renderMarketTooltip(unit: string) {
  return function MarketTooltip({ active, payload, label }: TooltipContentProps) {
    const value = payload?.[0]?.value;

    if (!active || typeof value !== "number" || typeof label !== "string") {
      return null;
    }

    return (
      <div className="theme-tooltip rounded-xl px-3 py-2">
        <p className="theme-muted text-xs font-medium">{formatTooltipDay(label)}</p>
        <p className="theme-text mt-1 text-sm font-semibold">{formatValue(value, unit)}</p>
      </div>
    );
  };
}

function MarketChart({
  points,
  unit,
  range,
}: {
  points: NonNullable<MacroIndicator["history"]>;
  unit: string;
  range: MarketRange;
}) {
  const [setChartContainerElement, chartSize] = useChartSize();

  if (points.length < 2) {
    return null;
  }

  const dates = points.map((point) => point.date);
  const ticks =
    range === "5y" ? getPeriodTicks(dates, 4) : range === "1m" ? undefined : getPeriodTicks(dates, 7);
  const tickFormatter =
    range === "5y" ? formatYearTick : range === "1m" ? formatDayTick : formatMonthTick;

  return (
    <div ref={setChartContainerElement} className="mt-2 h-24 w-full min-w-0">
      {chartSize.width > 0 && chartSize.height > 0 ? (
        <LineChart
          width={chartSize.width}
          height={chartSize.height}
          data={points}
          margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
        >
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={tickFormatter}
            minTickGap={20}
            interval="preserveStartEnd"
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            hide
            domain={[
              (dataMin: number) => dataMin - Math.abs(dataMin) * 0.02,
              (dataMax: number) => dataMax + Math.abs(dataMax) * 0.02,
            ]}
          />
          <Tooltip
            cursor={{ stroke: "var(--grid)", strokeDasharray: "3 3" }}
            content={renderMarketTooltip(unit)}
          />
          <Line
            type="monotone"
            dataKey="value"
            dot={false}
            stroke="var(--accent)"
            strokeWidth={2}
            activeDot={{ r: 3.5, stroke: "var(--surface-strong)", strokeWidth: 1.5 }}
            isAnimationActive={false}
          />
        </LineChart>
      ) : null}
    </div>
  );
}

function renderRegionTooltip() {
  return function RegionTooltip({ active, payload, label }: TooltipContentProps) {
    if (!active || !payload?.length || typeof label !== "string") {
      return null;
    }

    const inflationValue = payload.find((entry) => entry.dataKey === "inflation")?.value;
    const policyRateValue = payload.find((entry) => entry.dataKey === "policyRate")?.value;

    return (
      <div className="theme-tooltip rounded-xl px-3 py-2">
        <p className="theme-muted text-xs font-medium">{formatTooltipMonth(label)}</p>
        <p className="mt-1 text-xs text-[color:#dc2626]">
          Inflation: {typeof inflationValue === "number" ? `${inflationValue.toFixed(2)}%` : "-"}
        </p>
        <p className="text-xs text-[color:#2563eb]">
          Deposit Facility: {typeof policyRateValue === "number" ? `${policyRateValue.toFixed(2)}%` : "-"}
        </p>
      </div>
    );
  };
}

function RegionMacroChart({
  points,
}: {
  points: { date: string; inflation: number; policyRate: number }[];
}) {
  const [setChartContainerElement, chartSize] = useChartSize();

  if (points.length < 3) {
    return null;
  }

  const yearTicks = points
    .filter((point) => point.date.endsWith("-01-01"))
    .map((point) => point.date);

  return (
    <div ref={setChartContainerElement} className="mt-2 h-48 w-full min-w-0">
      {chartSize.width > 0 && chartSize.height > 0 ? (
        <LineChart
          width={chartSize.width}
          height={chartSize.height}
          data={points}
          margin={{ top: 4, right: 4, bottom: 14, left: 6 }}
        >
          <XAxis
            dataKey="date"
            ticks={yearTicks}
            tickFormatter={formatYearTick}
            minTickGap={24}
            interval="preserveStartEnd"
            tick={{ fill: "var(--muted)", fontSize: 10 }}
          />
          <YAxis
            hide
            domain={[
              (dataMin: number) => dataMin - Math.max(Math.abs(dataMin) * 0.08, 0.2),
              (dataMax: number) => dataMax + Math.max(Math.abs(dataMax) * 0.08, 0.2),
            ]}
          />
          <Tooltip content={renderRegionTooltip()} />
          <Line
            type="monotone"
            dataKey="inflation"
            dot={false}
            stroke="#dc2626"
            strokeWidth={3}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="policyRate"
            dot={false}
            stroke="#2563eb"
            strokeWidth={3}
            isAnimationActive={false}
          />
        </LineChart>
      ) : null}
    </div>
  );
}

function MarketCard({ indicator, range }: { indicator: MacroIndicator; range: MarketRange }) {
  const change = indicator.change ?? 0;
  const rangePoints = filterByRange(indicator.history ?? [], range);
  const first = rangePoints[0]?.value;
  const last = rangePoints[rangePoints.length - 1]?.value;
  const rangeChangePct =
    first !== undefined && last !== undefined && first !== 0 ? calcPctChange(last, first) : null;
  const rangeLabel = MARKET_RANGES.find((option) => option.id === range)?.label;
  const explainer = MARKET_EXPLAINERS[indicator.id];

  return (
    <div className="theme-panel flex flex-col rounded-xl border-[color:var(--accent-soft)] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="theme-muted text-xs">{indicator.label}</p>
        {rangeChangePct !== null ? (
          <p className={`text-xs font-medium ${getChangeColor(rangeChangePct)}`}>
            {formatPct(rangeChangePct)} · {rangeLabel}
          </p>
        ) : null}
      </div>
      <p className="theme-text mt-1 text-2xl font-semibold">
        {formatValue(indicator.value, indicator.unit)}
      </p>
      <p className={`mt-1 text-xs ${getChangeColor(change)}`}>
        {formatChange(change, indicator.unit)}
      </p>
      {explainer ? (
        <p className="theme-subtle mt-1.5 text-[11px] leading-snug">{explainer}</p>
      ) : null}
      <div className="mt-auto">
        <MarketChart points={rangePoints} unit={indicator.unit} range={range} />
      </div>
    </div>
  );
}

function RegionPanel({ region }: { region: MacroRegionContext }) {
  const inflationYoyChange = getYearOverYearChange(region.history, "inflation");
  const rateYoyChange = getYearOverYearChange(region.history, "policyRate");
  const inflationFreshness = getFreshness(latestHistoryDate(region.inflation.history));
  const rateFreshness = getFreshness(latestHistoryDate(region.policyRate.history));
  const inflationChange = inflationYoyChange ?? region.inflation.change ?? 0;
  const rateChange = rateYoyChange ?? region.policyRate.change ?? 0;
  const inflationBasis: ChangeBasis = inflationYoyChange !== null ? "year" : "previous";
  const rateBasis: ChangeBasis = rateYoyChange !== null ? "year" : "previous";
  const inflationColor =
    inflationChange > 0
      ? "text-[color:var(--danger)]"
      : inflationChange < 0
        ? "text-[color:var(--success)]"
        : "theme-muted";
  const rateColor =
    rateChange > 0
      ? "text-[color:var(--warning)]"
      : rateChange < 0
        ? "text-[color:var(--success)]"
        : "theme-muted";

  return (
    <div className="theme-panel rounded-xl p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="theme-muted text-[11px]">Inflation</p>
          <p className="theme-text text-xl font-semibold">
            {formatValue(region.inflation.value, region.inflation.unit)}
          </p>
          <p className={`text-xs ${inflationColor}`}>
            {formatChange(inflationChange, region.inflation.unit, inflationBasis)}
          </p>
          <p className={`text-[11px] ${inflationFreshness.className}`}>
            {inflationFreshness.text}
          </p>
        </div>
        <div>
          <p className="theme-muted text-[11px]">Deposit Facility</p>
          <p className="theme-text text-xl font-semibold">
            {formatValue(region.policyRate.value, region.policyRate.unit)}
          </p>
          <p className={`text-xs ${rateColor}`}>
            {formatChange(rateChange, region.policyRate.unit, rateBasis)}
          </p>
          <p className={`text-[11px] ${rateFreshness.className}`}>
            {rateFreshness.text}
          </p>
        </div>
      </div>

      <p className="theme-muted mt-3 text-[11px]">
        Red line: Inflation | Blue line: Deposit Facility
      </p>
      <RegionMacroChart points={region.history} />
    </div>
  );
}

export function MacroWidget() {
  const [marketRange, setMarketRange] = useState<MarketRange>("1y");
  const [selectedRegionId, setSelectedRegionId] = useState<RegionId>("eu");

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

  // Regions that failed upstream are missing from the payload; fall back to the first one loaded.
  const selectedRegion =
    data.regions.find((region) => region.id === selectedRegionId) ?? data.regions[0];

  return (
    <Card title="Macro & Markets" subtitle={`Sources: ${data.sources.join(", ")}`} icon={<MacroIcon className="h-5 w-5" />}>
      <div className="space-y-5">
        <section>
          <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="theme-text text-xs font-semibold uppercase tracking-[0.14em]">
                Markets Today
              </p>
              <p className="theme-muted text-xs">High-frequency indicators</p>
            </div>
            <div className="theme-toggle inline-flex items-center rounded-full p-1" role="tablist">
              {MARKET_RANGES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={marketRange === option.id}
                  onClick={() => setMarketRange(option.id)}
                  className={`theme-toggle-option rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
                    marketRange === option.id ? "theme-toggle-option-active" : ""
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </header>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.marketsToday.map((indicator) => (
              <MarketCard key={indicator.id} indicator={indicator} range={marketRange} />
            ))}
          </div>
        </section>

        <section>
          <header className="mb-2">
            <p className="theme-text text-xs font-semibold uppercase tracking-[0.14em]">
              Macro Environment
            </p>
            <p className="theme-muted text-xs">Inflation vs policy rate by region</p>
          </header>
          <div
            className="theme-toggle mb-3 inline-flex w-full items-center rounded-full p-1 sm:w-auto"
            role="tablist"
          >
            {data.regions.map((region) => (
              <button
                key={region.id}
                type="button"
                role="tab"
                aria-selected={selectedRegion?.id === region.id}
                onClick={() => setSelectedRegionId(region.id)}
                className={`theme-toggle-option flex flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold tracking-wide sm:flex-none sm:px-3 ${
                  selectedRegion?.id === region.id ? "theme-toggle-option-active" : ""
                }`}
              >
                <Flag code={REGION_FLAGS[region.id]} className="h-3.5 w-[18px]" />
                <span className="sm:hidden">{REGION_SHORT[region.id]}</span>
                <span className="hidden sm:inline">{region.label}</span>
              </button>
            ))}
          </div>
          {selectedRegion ? <RegionPanel region={selectedRegion} /> : null}
        </section>
      </div>
    </Card>
  );
}
