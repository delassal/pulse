"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TravelMap } from "@/components/travel/TravelMap";
import {
  LEGENDS,
  SEVERITY_COLOR,
  SOURCE_LABELS,
  TRAVEL_VIEWS,
  severityFor,
  severitySpread,
  type TravelView,
} from "@/lib/travel-meta";
import type { ApiError, TravelAdvisoryData, TravelCountry, TravelSourceId } from "@/types";

const SOURCE_ORDER: TravelSourceId[] = ["de", "us", "ca"];

async function fetchTravel(): Promise<TravelAdvisoryData> {
  const response = await fetch("/api/travel");
  const body = (await response.json()) as TravelAdvisoryData | ApiError;
  if (!response.ok || "error" in body) {
    throw new Error("error" in body ? body.error : "Unable to load travel advisories");
  }
  return body;
}

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Swatch({ severity, size = 10 }: { severity: number; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block flex-none rounded-[3px]"
      style={{
        width: size,
        height: size,
        background: SEVERITY_COLOR[severity as keyof typeof SEVERITY_COLOR],
      }}
    />
  );
}

function CountryDetail({ country }: { country: TravelCountry }) {
  return (
    <div className="theme-surface rounded-2xl p-4 sm:p-5">
      <p className="theme-muted text-xs font-medium uppercase tracking-wide">Selected country</p>
      <h2 className="mt-1 text-xl font-semibold">{country.name}</h2>
      <ul className="mt-3 divide-y" style={{ borderColor: "var(--border)" }}>
        {SOURCE_ORDER.map((id) => {
          const advisory = country.advisories[id];
          return (
            <li
              key={id}
              className="flex items-start gap-3 py-2.5"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="mt-1.5">
                <Swatch severity={advisory?.severity ?? 0} size={12} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="theme-subtle text-xs">{SOURCE_LABELS[id]}</p>
                <p className="text-sm font-medium">
                  {advisory ? advisory.label : "No data"}
                  {advisory?.regional ? (
                    <span className="theme-panel theme-muted ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium">
                      some regions only
                    </span>
                  ) : null}
                </p>
                {advisory?.updatedAt || advisory?.url ? (
                  <p className="theme-subtle mt-0.5 text-xs">
                    {formatDate(advisory.updatedAt) ? `Updated ${formatDate(advisory.updatedAt)}` : null}
                    {advisory.url ? (
                      <>
                        {formatDate(advisory.updatedAt) ? " · " : null}
                        <a
                          href={advisory.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2"
                        >
                          Details
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TravelExplorer() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["travel"],
    queryFn: fetchTravel,
    staleTime: 60 * 60 * 1000,
    refetchInterval: false,
  });

  const [view, setView] = useState<TravelView>("de");
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ iso2: string; n: number } | null>(null);
  const [query, setQuery] = useState("");

  const countries = useMemo(() => data?.countries ?? [], [data]);
  const selectedCountry = countries.find((country) => country.iso2 === selected);

  const counts = useMemo(() => {
    const result: Record<number, number> = {};
    for (const country of countries) {
      const severity = severityFor(country, view);
      if (severity) result[severity] = (result[severity] ?? 0) + 1;
    }
    return result;
  }, [countries, view]);

  const highest = useMemo(
    () => countries.filter((country) => severityFor(country, view) === 4),
    [countries, view],
  );

  const disagreements = useMemo(
    () =>
      countries
        .filter((country) => severitySpread(country) >= 2)
        .sort(
          (a, b) =>
            severitySpread(b) - severitySpread(a) ||
            severityFor(b, "max") - severityFor(a, "max") ||
            a.name.localeCompare(b.name, "en"),
        )
        .slice(0, 12),
    [countries],
  );

  function pick(iso2: string) {
    setSelected(iso2);
    setFocus((current) => ({ iso2, n: (current?.n ?? 0) + 1 }));
  }

  function onSearch(value: string) {
    setQuery(value);
    const match = countries.find((country) => country.name.toLowerCase() === value.trim().toLowerCase());
    if (match) {
      pick(match.iso2);
      setQuery("");
    }
  }

  if (isLoading) {
    return (
      <div className="theme-surface flex aspect-[96/50] items-center justify-center rounded-2xl">
        <p className="theme-muted text-sm">Loading advisories from three foreign ministries…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="theme-surface rounded-2xl p-5">
        <p className="text-sm font-medium text-[color:var(--danger)]">Travel advisories unavailable</p>
        <p className="theme-subtle mt-1 text-sm">
          {error instanceof Error ? error.message : "Please try again later."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="theme-toggle inline-flex w-full items-center rounded-full p-1 sm:w-auto" role="tablist">
          {TRAVEL_VIEWS.map((option) => {
            const source = data.sources.find((item) => item.id === option.id);
            const unavailable = source ? !source.ok : false;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={view === option.id}
                disabled={unavailable}
                onClick={() => setView(option.id)}
                className={`theme-toggle-option flex-1 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide disabled:opacity-40 sm:flex-none ${
                  view === option.id ? "theme-toggle-option-active" : ""
                }`}
              >
                <span className="sm:hidden">{option.short}</span>
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            );
          })}
        </div>

        <label className="relative block w-full sm:w-64">
          <span className="sr-only">Find a country</span>
          <input
            id="travel-country-search"
            list="travel-country-list"
            value={query}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Find a country"
            className="theme-panel theme-text w-full rounded-full px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
          />
          <datalist id="travel-country-list">
            {countries.map((country) => (
              <option key={country.iso2} value={country.name} />
            ))}
          </datalist>
        </label>
      </div>

      <section className="theme-surface rounded-2xl p-3 sm:p-4">
        <TravelMap
          countries={countries}
          view={view}
          selected={selected}
          focus={focus}
          onSelect={setSelected}
        />
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
          {LEGENDS[view].map((item) => (
            <li key={item.severity} className="theme-muted flex items-center gap-2 text-xs">
              <Swatch severity={item.severity} />
              <span>{item.label}</span>
              <span className="theme-subtle tabular-nums">{counts[item.severity] ?? 0}</span>
            </li>
          ))}
          <li className="theme-subtle flex items-center gap-2 text-xs">
            <Swatch severity={0} />
            No data
          </li>
        </ul>
      </section>

      {selectedCountry ? (
        <CountryDetail country={selectedCountry} />
      ) : (
        <p className="theme-subtle px-1 text-sm">
          Tap a country to compare what Germany, the US and Canada advise.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="theme-surface min-w-0 rounded-2xl p-4 sm:p-5">
          <p className="theme-muted text-xs font-medium uppercase tracking-wide">Highest level</p>
          <p className="theme-subtle mt-1 text-sm">
            {LEGENDS[view][0].label}: {highest.length} countries
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {highest.map((country) => (
              <button
                key={country.iso2}
                type="button"
                onClick={() => pick(country.iso2)}
                className={`theme-panel rounded-lg px-2.5 py-1 text-xs font-medium ${
                  selected === country.iso2 ? "ring-2 ring-[color:var(--foreground)]" : ""
                }`}
              >
                {country.name}
              </button>
            ))}
          </div>
        </section>

        <section className="theme-surface min-w-0 rounded-2xl p-4 sm:p-5">
          <p className="theme-muted text-xs font-medium uppercase tracking-wide">Where sources disagree</p>
          <p className="theme-subtle mt-1 text-sm">At least two levels apart between DE, US and CA.</p>
          <ul className="mt-3 space-y-1">
            {disagreements.map((country) => (
              <li key={country.iso2}>
                <button
                  type="button"
                  onClick={() => pick(country.iso2)}
                  className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left text-sm hover:bg-[color:var(--accent-soft)]"
                >
                  <span className="min-w-0 flex-1 truncate">{country.name}</span>
                  {SOURCE_ORDER.map((id) => (
                    <span key={id} className="theme-subtle flex items-center gap-1 text-[11px] tabular-nums">
                      <Swatch severity={country.advisories[id]?.severity ?? 0} />
                      {id.toUpperCase()}
                    </span>
                  ))}
                </button>
              </li>
            ))}
            {disagreements.length === 0 ? (
              <li className="theme-subtle text-sm">The sources currently agree closely.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <footer className="theme-subtle space-y-1 px-1 text-xs">
        {data.sources.map((source) => (
          <p key={source.id}>
            {source.name}:{" "}
            {source.ok
              ? `${source.count} countries${source.unmatched?.length ? `, ${source.unmatched.length} unmatched (${source.unmatched.join(", ")})` : ""}`
              : `unavailable (${source.error ?? "error"})`}
          </p>
        ))}
        <p>
          Levels are mapped onto a shared 1 to 4 scale for colouring. Germany only distinguishes no warning, partial
          warning and full warning. Always check the official advisory before travelling.
        </p>
      </footer>
    </div>
  );
}
