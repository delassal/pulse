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
import {
  ChinaOutlineIcon,
  EuropeOutlineIcon,
  MacroIcon,
  RussiaOutlineIcon,
  UkOutlineIcon,
  UsOutlineIcon,
} from "@/components/ui/Icons";
import type { ApiError, MacroData } from "@/types";

type ChangeBasis = "previous" | "year";

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

function getRegionIcon(regionId: string) {
  switch (regionId) {
    case "eu":
      return <EuropeOutlineIcon className="h-4 w-4" />;
    case "uk":
      return <UkOutlineIcon className="h-4 w-4" />;
    case "us":
      return <UsOutlineIcon className="h-4 w-4" />;
    case "russia":
      return <RussiaOutlineIcon className="h-4 w-4" />;
    case "china":
      return <ChinaOutlineIcon className="h-4 w-4" />;
    default:
      return <MacroIcon className="h-4 w-4" />;
  }
}

function formatMonthTick(value: string) {
  return value.slice(0, 4);
}

function formatTooltipDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    year: "numeric",
    month: "long",
  }).format(new Date(`${value}T00:00:00`));
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

function renderRegionTooltip() {
  return function RegionTooltip({ active, payload, label }: TooltipContentProps) {
    if (!active || !payload?.length || typeof label !== "string") {
      return null;
    }

    const inflationValue = payload.find((entry) => entry.dataKey === "inflation")?.value;
    const policyRateValue = payload.find((entry) => entry.dataKey === "policyRate")?.value;

    return (
      <div className="theme-tooltip rounded-xl px-3 py-2">
        <p className="theme-muted text-xs font-medium">{formatTooltipDate(label)}</p>
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

  if (points.length < 3) {
    return null;
  }

  const yearTicks = points
    .filter((point) => point.date.endsWith("-01-01"))
    .map((point) => point.date);

  return (
    <div ref={setChartContainerElement} className="mt-2 h-40 w-full min-w-0">
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
            tickFormatter={formatMonthTick}
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
            <p className="theme-muted text-xs">Inflation vs policy rate by region</p>
          </header>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.regions.map((region) => {
              const inflationYoyChange = getYearOverYearChange(region.history, "inflation");
              const rateYoyChange = getYearOverYearChange(region.history, "policyRate");
              const inflationLatest = latestHistoryDate(region.inflation.history);
              const rateLatest = latestHistoryDate(region.policyRate.history);
              const inflationFreshness = getFreshness(inflationLatest);
              const rateFreshness = getFreshness(rateLatest);
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
                <div
                  key={region.id}
                  className="theme-panel rounded-xl p-3"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="theme-icon-shell flex h-6 w-6 items-center justify-center rounded-lg">
                      {getRegionIcon(region.id)}
                    </span>
                    <p className="theme-text text-sm font-semibold">{region.label}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="theme-muted text-[11px]">Inflation</p>
                      <p className="theme-text text-base font-semibold">
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
                      <p className="theme-text text-base font-semibold">
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

                  <p className="theme-muted mt-2 text-[11px]">
                    Red line: Inflation | Blue line: Deposit Facility
                  </p>
                  <RegionMacroChart points={region.history} />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Card>
  );
}
