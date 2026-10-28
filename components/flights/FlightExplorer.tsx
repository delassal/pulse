"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { cheapestFares } from "@/lib/flight-utils";
import type {
  ApiError,
  FlightData,
  FlightDestination,
  FlightFare,
  FlightHistory,
  FlightRegion,
} from "@/types";

type TripType = "roundTrip" | "oneWay";
type SortKey = "price" | "drop" | "name";

const REGIONS: Array<FlightRegion | "All"> = [
  "All",
  "Europe",
  "Asia",
  "Middle East",
  "Africa",
  "Americas",
  "Oceania",
];
const PRICE_CAPS = [0, 150, 300, 600, 900, 1200];
const PAGE_SIZE = 40;
const TREND_DAYS = 7;

async function fetchFlights(): Promise<FlightData> {
  const response = await fetch("/api/flights");
  const json = (await response.json()) as FlightData | ApiError;
  if (!response.ok || "error" in json) {
    throw new Error("error" in json ? json.error : `HTTP ${response.status}`);
  }
  return json;
}

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function monthLabel(month: string, withYear = true) {
  const [year, mon] = month.split("-").map(Number);
  const name = new Date(Date.UTC(year, mon - 1, 1)).toLocaleString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  return withYear ? `${name} ’${String(year).slice(2)}` : name;
}

/** "2026-11-18T10:25:00+01:00" → "18 Nov", without converting time zones. */
function dayLabel(iso: string) {
  const [year, mon, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1, day)).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function durationLabel(minutes: number | null) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function flagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/[A-Z]/g, (letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65));
}

function stopsLabel(stops: number) {
  if (stops === 0) return "nonstop";
  return stops === 1 ? "1 stop" : `${stops} stops`;
}

interface Row {
  destination: FlightDestination;
  best: { fare: FlightFare; month: string } | null;
  /** Price change versus TREND_DAYS ago (negative = cheaper now). */
  change: number | null;
  lowestTracked: boolean;
  history: number[];
}

function historyFor(history: FlightHistory | null, code: string, trip: TripType) {
  const row = history?.series[code];
  if (!row) return [];
  const index = trip === "oneWay" ? 0 : 1;
  return row.map((point) => point[index]).filter((value): value is number => value !== null);
}

function buildRows(data: FlightData, trip: TripType): Row[] {
  const destinations = Object.values(data.snapshot?.destinations ?? {});
  return destinations.map((destination) => {
    const best = cheapestFares(destination)[trip];
    const history = historyFor(data.history, destination.code, trip);
    const previous = history.length > TREND_DAYS ? history[history.length - 1 - TREND_DAYS] : null;
    const change = best && previous ? best.fare.price - previous : null;
    const lowestTracked =
      best !== null && history.length >= TREND_DAYS && best.fare.price <= Math.min(...history);
    return { destination, best, change, lowestTracked, history };
  });
}

function MonthStrip({
  destination,
  months,
  trip,
}: {
  destination: FlightDestination;
  months: string[];
  trip: TripType;
}) {
  const prices = months.map((month) => destination.months[month]?.[trip]?.price ?? null);
  const known = prices.filter((price): price is number => price !== null);
  const min = Math.min(...known);
  const max = Math.max(...known);

  return (
    <div className="grid grid-cols-12 gap-[3px]" aria-hidden>
      {prices.map((price, index) => {
        const share = price === null || max === min ? 0 : (price - min) / (max - min);
        return (
          <span
            key={months[index]}
            title={price === null ? `${monthLabel(months[index])}: no fare` : `${monthLabel(months[index])}: ${euro.format(price)}`}
            className="h-2.5 rounded-[3px]"
            style={{
              background:
                price === null
                  ? "var(--sev-none)"
                  : `color-mix(in srgb, var(--sev-3) ${Math.round(share * 100)}%, var(--sev-1))`,
            }}
          />
        );
      })}
    </div>
  );
}

function FareCard({ month, fare }: { month: string; fare: FlightFare | undefined }) {
  if (!fare) {
    return (
      <div className="theme-panel rounded-xl p-3 opacity-60">
        <p className="theme-muted text-xs font-semibold uppercase tracking-wide">{monthLabel(month)}</p>
        <p className="theme-subtle mt-1 text-sm">No cached fare</p>
      </div>
    );
  }

  const outbound = `${dayLabel(fare.departureAt)}${fare.returnAt ? ` → ${dayLabel(fare.returnAt)}` : ""}`;
  const stops =
    fare.returnTransfers !== null && fare.returnAt
      ? `${stopsLabel(fare.transfers)} / ${stopsLabel(fare.returnTransfers)}`
      : stopsLabel(fare.transfers);

  return (
    <a
      href={fare.link}
      target="_blank"
      rel="noreferrer"
      className="theme-panel block rounded-xl p-3 transition-colors hover:bg-[color:var(--accent-soft)]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="theme-muted text-xs font-semibold uppercase tracking-wide">{monthLabel(month)}</p>
        <p className="text-base font-semibold">{euro.format(fare.price)}</p>
      </div>
      <p className="mt-1 text-sm">{outbound}</p>
      <p className="theme-subtle mt-0.5 text-xs">
        {[fare.airline, stops, durationLabel(fare.duration)].filter(Boolean).join(" · ")}
      </p>
    </a>
  );
}

function PriceHistory({ values }: { values: number[] }) {
  if (values.length < 2) {
    return (
      <p className="theme-subtle text-xs">
        Price history builds up with every daily crawl.
      </p>
    );
  }
  const data = values.map((price, index) => ({ index, price }));
  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <YAxis hide domain={["dataMin - 20", "dataMax + 20"]} />
          <Tooltip
            cursor={false}
            contentStyle={{
              background: "var(--tooltip-bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelFormatter={() => ""}
            formatter={(value) => [euro.format(Number(value)), "Cheapest"]}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DestinationRow({
  row,
  months,
  trip,
  open,
  onToggle,
}: {
  row: Row;
  months: string[];
  trip: TripType;
  open: boolean;
  onToggle: () => void;
}) {
  const { destination, best, change, lowestTracked } = row;

  return (
    <li className="theme-surface overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left sm:gap-4 sm:p-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {destination.countryCode ? (
              <span className="flex-none text-sm leading-none" aria-hidden>
                {flagEmoji(destination.countryCode)}
              </span>
            ) : null}
            <p className="truncate font-semibold">{destination.name}</p>
            <span className="theme-subtle flex-none text-xs">{destination.code}</span>
          </div>
          <p className="theme-subtle truncate text-xs">{destination.country}</p>
          <div className="mt-2 max-w-xs">
            <MonthStrip destination={destination} months={months} trip={trip} />
          </div>
        </div>

        <div className="flex-none text-right">
          <p className="text-lg font-semibold leading-tight">{best ? euro.format(best.fare.price) : "n/a"}</p>
          {best ? (
            <p className="theme-subtle text-xs">
              {monthLabel(best.month)} · {stopsLabel(best.fare.transfers)}
            </p>
          ) : null}
          <div className="mt-1 flex justify-end gap-1.5">
            {lowestTracked ? (
              <span className="rounded-full bg-[color:var(--accent-soft)] px-2 py-px text-[10px] font-semibold text-[color:var(--accent)]">
                Lowest tracked
              </span>
            ) : null}
            {change ? (
              <span
                className="text-[11px] font-semibold"
                style={{ color: change < 0 ? "var(--success)" : "var(--danger)" }}
              >
                {change < 0 ? "▼" : "▲"} {euro.format(Math.abs(change))}
              </span>
            ) : null}
          </div>
        </div>
      </button>

      {open ? (
        <div className="border-t px-3.5 pb-4 pt-3 sm:px-4" style={{ borderColor: "var(--border)" }}>
          <p className="theme-muted mb-1 text-xs font-semibold uppercase tracking-wide">
            Cheapest fare, daily
          </p>
          <PriceHistory values={row.history} />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {months.map((month) => (
              <FareCard key={month} month={month} fare={destination.months[month]?.[trip]} />
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function FlightExplorer() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["flights"],
    queryFn: fetchFlights,
    refetchInterval: false,
    staleTime: 15 * 60_000,
  });

  const [trip, setTrip] = useState<TripType>("roundTrip");
  const [region, setRegion] = useState<FlightRegion | "All">("All");
  const [query, setQuery] = useState("");
  const [cap, setCap] = useState(0);
  const [sort, setSort] = useState<SortKey>("price");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const allRows = useMemo(() => (data ? buildRows(data, trip) : []), [data, trip]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = allRows.filter(({ destination, best }) => {
      if (!best) return false;
      if (region !== "All" && destination.region !== region) return false;
      if (cap && best.fare.price > cap) return false;
      if (!needle) return true;
      return [destination.name, destination.country, destination.code].some((value) =>
        value.toLowerCase().includes(needle),
      );
    });

    return filtered.sort((a, b) => {
      if (sort === "name") return a.destination.name.localeCompare(b.destination.name);
      if (sort === "drop") return (a.change ?? 0) - (b.change ?? 0);
      return (a.best?.fare.price ?? Infinity) - (b.best?.fare.price ?? Infinity);
    });
  }, [allRows, region, cap, query, sort]);

  if (isLoading) {
    return (
      <div className="theme-surface flex h-48 items-center justify-center rounded-2xl">
        <p className="theme-muted text-sm">Loading fares from Munich…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="theme-surface rounded-2xl p-5">
        <p className="text-sm font-medium text-[color:var(--danger)]">Flight prices unavailable</p>
        <p className="theme-subtle mt-1 text-sm">{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    );
  }

  if (!data.snapshot) {
    return (
      <div className="theme-surface rounded-2xl p-5">
        <p className="text-sm font-medium">No fares yet</p>
        <p className="theme-subtle mt-1 text-sm">{data.notice}</p>
      </div>
    );
  }

  const { snapshot } = data;
  const months = snapshot.months;
  const crawled = new Date(snapshot.crawledAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const cheapest = rows[0]?.best;
  const selectClass =
    "theme-panel theme-text rounded-full px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="theme-toggle inline-flex w-full items-center rounded-full p-1 sm:w-auto" role="tablist">
          {(
            [
              ["roundTrip", "Round trip"],
              ["oneWay", "One way"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={trip === value}
              onClick={() => setTrip(value)}
              className={`theme-toggle-option flex-1 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide sm:flex-none ${
                trip === value ? "theme-toggle-option-active" : ""
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="block w-full sm:w-64">
          <span className="sr-only">Find a destination</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Find a city or country"
            className="theme-panel theme-text w-full rounded-full px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
          />
        </label>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {REGIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setRegion(option);
              setVisible(PAGE_SIZE);
            }}
            className={`theme-toggle-option theme-panel flex-none rounded-full px-3 py-1.5 text-xs font-semibold ${
              region === option ? "theme-toggle-option-active" : ""
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={cap}
          onChange={(event) => setCap(Number(event.target.value))}
          className={selectClass}
          aria-label="Maximum price"
        >
          {PRICE_CAPS.map((value) => (
            <option key={value} value={value}>
              {value ? `Up to ${euro.format(value)}` : "Any price"}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          className={selectClass}
          aria-label="Sort"
        >
          <option value="price">Cheapest first</option>
          <option value="drop">Biggest drop (7 days)</option>
          <option value="name">A to Z</option>
        </select>
        <p className="theme-subtle ml-auto text-xs">
          {rows.length} destinations · {monthLabel(months[0])} to {monthLabel(months[months.length - 1])} ·
          updated {crawled}
        </p>
      </div>

      {cheapest && sort === "price" && rows[0] ? (
        <p className="theme-muted text-sm">
          Cheapest right now: <span className="theme-text font-semibold">{rows[0].destination.name}</span> for{" "}
          <span className="theme-text font-semibold">{euro.format(cheapest.fare.price)}</span> in{" "}
          {monthLabel(cheapest.month)}.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="theme-surface rounded-2xl p-5">
          <p className="theme-muted text-sm">No destinations match these filters.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.slice(0, visible).map((row) => (
            <DestinationRow
              key={row.destination.code}
              row={row}
              months={months}
              trip={trip}
              open={openCode === row.destination.code}
              onToggle={() =>
                setOpenCode((current) => (current === row.destination.code ? null : row.destination.code))
              }
            />
          ))}
        </ul>
      )}

      {rows.length > visible ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((count) => count + PAGE_SIZE)}
            className="theme-toggle-option theme-panel rounded-full px-4 py-2 text-sm font-semibold"
          >
            Show {Math.min(PAGE_SIZE, rows.length - visible)} more
          </button>
        </div>
      ) : null}

      <p className="theme-subtle text-xs">
        Prices are the cheapest fares travellers found on Aviasales in the last days (Travelpayouts Data API),
        not live quotes. Check the final price on the booking page. Month colors run from cheap (teal) to
        expensive (orange) per destination.
      </p>
    </div>
  );
}
