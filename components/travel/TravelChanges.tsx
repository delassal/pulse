"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flag } from "@/components/ui/Flag";
import { Swatch } from "@/components/travel/Swatch";
import { SOURCE_ORDER, TRAVEL_VIEWS, isRaised } from "@/lib/travel-meta";
import type { ApiError, TravelChange, TravelChangeData, TravelSourceId } from "@/types";

async function fetchTravelChanges(): Promise<TravelChangeData> {
  const response = await fetch("/api/travel/changes");
  const body = (await response.json()) as TravelChangeData | ApiError;
  if (!response.ok || "error" in body) {
    throw new Error("error" in body ? body.error : "Unable to load advisory changes");
  }
  return body;
}

/** Shared by the dashboard card and the /travel page so both read one cached response. */
export const TRAVEL_CHANGES_QUERY = {
  queryKey: ["travel", "changes"],
  queryFn: fetchTravelChanges,
  staleTime: 60 * 60 * 1000,
  refetchInterval: false,
} as const;

const PERIODS = [
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
  { id: "1y", label: "1 year", days: 365 },
  { id: "all", label: "All", days: null },
] as const;

type PeriodId = (typeof PERIODS)[number]["id"];

const PAGE_SIZE = 10;

export function formatChangeDate(day: string, withYear = true) {
  return new Date(`${day}T00:00:00`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

/** Source flag plus the old and the new level as colour swatches. */
export function ChangeSwatches({ change }: { change: TravelChange }) {
  return (
    <span className="flex flex-none items-center gap-1.5">
      <Flag code={change.source} className="h-3 w-4" />
      <span className="flex items-center gap-1">
        <Swatch severity={change.from} />
        <span aria-hidden className="theme-subtle text-[10px] leading-none">
          →
        </span>
        <Swatch severity={change.to} />
      </span>
    </span>
  );
}

export function ChangeDirection({ change, label = true }: { change: TravelChange; label?: boolean }) {
  const raised = isRaised(change);
  return (
    <span
      className="whitespace-nowrap text-xs font-semibold"
      style={{ color: raised ? "var(--danger)" : "var(--success)" }}
    >
      <span aria-hidden>{raised ? "▲" : "▼"}</span>
      {label ? (raised ? " Raised" : " Lowered") : <span className="sr-only">{raised ? "Raised" : "Lowered"}</span>}
    </span>
  );
}

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export function TravelChanges({
  selected,
  onPick,
}: {
  selected: string | null;
  onPick: (iso2: string) => void;
}) {
  const { data, isLoading, error } = useQuery(TRAVEL_CHANGES_QUERY);
  const [period, setPeriod] = useState<PeriodId>("90d");
  const [source, setSource] = useState<TravelSourceId | "all">("all");
  const [expanded, setExpanded] = useState(false);

  const changes = useMemo(() => {
    const days = PERIODS.find((option) => option.id === period)?.days ?? null;
    const since = days === null ? "" : daysAgoIso(days);
    return (data?.changes ?? []).filter(
      (change) => change.date >= since && (source === "all" || change.source === source),
    );
  }, [data, period, source]);

  const raised = changes.filter(isRaised).length;
  const visible = expanded ? changes : changes.slice(0, PAGE_SIZE);

  return (
    <section className="theme-surface min-w-0 rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="theme-muted text-xs font-medium uppercase tracking-wide">Level changes</p>
          <p className="theme-subtle mt-1 text-sm">
            {isLoading
              ? "Loading the change log…"
              : error
                ? "The change log is unavailable right now."
                : changes.length === 0
                  ? "No country was moved to another level in this period."
                  : `${changes.length} ${changes.length === 1 ? "change" : "changes"}: ${raised} raised, ${changes.length - raised} lowered`}
          </p>
        </div>
        <div className="theme-toggle inline-flex w-full items-center rounded-full p-1 sm:w-auto" role="tablist">
          {PERIODS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={period === option.id}
              onClick={() => {
                setPeriod(option.id);
                setExpanded(false);
              }}
              className={`theme-toggle-option flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide sm:flex-none ${
                period === option.id ? "theme-toggle-option-active" : ""
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["all", ...SOURCE_ORDER] as const).map((id) => {
          const view = TRAVEL_VIEWS.find((option) => option.id === id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={source === id}
              onClick={() => {
                setSource(id);
                setExpanded(false);
              }}
              className={`theme-toggle-option theme-panel flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                source === id ? "theme-toggle-option-active" : ""
              }`}
            >
              {view ? <Flag code={view.id} className="h-3 w-4" /> : null}
              {view ? view.short : "All sources"}
            </button>
          );
        })}
      </div>

      {visible.length > 0 ? (
        <ul className="mt-2 divide-y divide-[color:var(--border)]">
          {visible.map((change) => (
            <li key={`${change.source}-${change.iso2}-${change.date}-${change.to}`}>
              <button
                type="button"
                onClick={() => onPick(change.iso2)}
                title={`${change.fromLabel} → ${change.toLabel}`}
                className={`flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left hover:bg-[color:var(--accent-soft)] ${
                  selected === change.iso2 ? "bg-[color:var(--accent-soft)]" : ""
                }`}
              >
                <ChangeSwatches change={change} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{change.name}</span>
                  <span className="theme-subtle block truncate text-xs">
                    {change.toLabel}
                    <span className="hidden sm:inline"> · before: {change.fromLabel}</span>
                  </span>
                </span>
                <span className="flex flex-none flex-col items-end">
                  <ChangeDirection change={change} />
                  <span className="theme-subtle text-xs tabular-nums">{formatChangeDate(change.date)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {changes.length > PAGE_SIZE ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-xs font-semibold text-[color:var(--accent)]"
        >
          {expanded ? "Show fewer" : `Show all ${changes.length}`}
        </button>
      ) : null}

      {data ? (
        <p className="theme-subtle mt-3 text-xs">
          Recorded by comparing the sources&apos; levels once a day; a new level is listed once two daily checks
          agree on it. On record since:{" "}
          {SOURCE_ORDER.filter((id) => data.trackingSince[id]).map((id, index) => (
            <span key={id} className="whitespace-nowrap">
              {index > 0 ? " · " : null}
              {TRAVEL_VIEWS.find((view) => view.id === id)?.short} {formatChangeDate(data.trackingSince[id]!)}
            </span>
          ))}
          .
        </p>
      ) : null}
    </section>
  );
}
