"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, Tooltip, YAxis } from "recharts";
import { useChartSize } from "@/components/ui/useChartSize";
import {
  FLIGHT_STAYS,
  cheapestFare,
  fareFor,
  stayNights,
  type FareMatch,
  type FlightTrip,
} from "@/lib/flight-utils";
import type {
  ApiError,
  FlightData,
  FlightDestination,
  FlightFare,
  FlightHistory,
  FlightRegion,
  FlightStay,
} from "@/types";

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
const PAGE_SIZE = 40;
const TREND_DAYS = 7;

// Price bands in steps of 100: up to 100, 100 to 200, ... and one open band at the top.
const PRICE_STEP = 100;
const PRICE_BANDS = 15;

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

/** Band 0 is up to 100, band 1 is above 100 up to 200, ..., band PRICE_BANDS is everything above. */
function priceBand(price: number) {
  return Math.min(PRICE_BANDS, Math.max(0, Math.ceil(price / PRICE_STEP) - 1));
}

function priceBandLabel(band: number) {
  if (band === 0) return `Up to ${euro.format(PRICE_STEP)}`;
  if (band === PRICE_BANDS) return `Over ${euro.format(PRICE_BANDS * PRICE_STEP)}`;
  return `${(band * PRICE_STEP).toLocaleString("de-DE")} – ${euro.format((band + 1) * PRICE_STEP)}`;
}

function monthName(month: string, format: "short" | "long" | "narrow" = "short") {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleString("en-GB", {
    month: format,
    timeZone: "UTC",
  });
}

function monthLabel(month: string, format: "short" | "long" = "short") {
  const year = month.slice(0, 4);
  return format === "long"
    ? `${monthName(month, "long")} ${year}`
    : `${monthName(month)} ’${year.slice(2)}`;
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

function nightsLabel(fare: FlightFare) {
  const nights = stayNights(fare.departureAt, fare.returnAt);
  if (nights === null) return null;
  if (nights === 0) return "same day";
  return nights === 1 ? "1 night" : `${nights} nights`;
}

/** The same dates on other search sites, to cross-check the cached price before booking. */
function compareLinks(destination: FlightDestination, fare: FlightFare) {
  const depart = fare.departureAt.slice(0, 10);
  const back = fare.returnAt?.slice(0, 10);

  const trip = new URLSearchParams({
    dcity: "muc",
    acity: destination.code.toLowerCase(),
    ddate: depart,
    ...(back ? { rdate: back } : {}),
    triptype: back ? "rt" : "ow",
    class: "y",
    quantity: "1",
    locale: "en-XX",
    curr: "EUR",
  });

  const google = new URLSearchParams({
    q: `Flights from Munich to ${destination.name} on ${depart}${back ? ` through ${back}` : " one way"}`,
    curr: "EUR",
  });

  return [
    { label: "Trip.com", href: `https://www.trip.com/flights/showfarefirst?${trip}` },
    { label: "Google Flights", href: `https://www.google.com/travel/flights?${google}` },
  ];
}

interface Filters {
  trip: FlightTrip;
  /** Departure month (YYYY-MM), or null for the whole window. */
  month: string | null;
  /** Length of stay, round trips only. */
  stay: FlightStay | null;
}

interface Row {
  destination: FlightDestination;
  best: FareMatch;
  /** Price change versus TREND_DAYS ago (negative = cheaper now); only without month or stay filter. */
  change: number | null;
  lowestTracked: boolean;
  history: number[];
}

function historyFor(history: FlightHistory | null, code: string, trip: FlightTrip) {
  const row = history?.series[code];
  if (!row) return [];
  const index = trip === "oneWay" ? 0 : 1;
  return row.map((point) => point[index]).filter((value): value is number => value !== null);
}

function buildRows(data: FlightData, { trip, month, stay }: Filters): Row[] {
  // The daily history tracks the cheapest fare over all months and lengths of stay.
  const comparable = !month && !stay;
  const rows: Row[] = [];

  for (const destination of Object.values(data.snapshot?.destinations ?? {})) {
    const best = cheapestFare(destination, trip, { month, stay });
    if (!best) continue;

    const history = historyFor(data.history, destination.code, trip);
    const previous = history.length > TREND_DAYS ? history[history.length - 1 - TREND_DAYS] : null;
    rows.push({
      destination,
      best,
      history,
      change: comparable && previous ? best.fare.price - previous : null,
      lowestTracked:
        comparable && history.length >= TREND_DAYS && best.fare.price <= Math.min(...history),
    });
  }

  return rows;
}

function MonthStrip({
  destination,
  months,
  filters,
  bestMonth,
}: {
  destination: FlightDestination;
  months: string[];
  filters: Filters;
  bestMonth: string;
}) {
  const prices = months.map(
    (month) => fareFor(destination.months[month], filters.trip, filters.stay)?.price ?? null,
  );
  const known = prices.filter((price): price is number => price !== null);
  const min = Math.min(...known);
  const max = Math.max(...known);

  return (
    <div
      className="grid gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
      aria-hidden
    >
      {months.map((month, index) => {
        const price = prices[index];
        const share = price === null || max === min ? 0 : (price - min) / (max - min);
        const isBest = month === bestMonth;
        const dimmed = filters.month !== null && filters.month !== month;
        return (
          <div
            key={month}
            title={`${monthLabel(month, "long")}: ${price === null ? "no fare" : euro.format(price)}`}
            className={`min-w-0 ${dimmed ? "opacity-35" : ""} ${
              // A hairline where the year turns.
              month.endsWith("-01") && index > 0 ? "border-l border-[color:var(--muted)] pl-[3px]" : ""
            }`}
          >
            <span
              className="block h-2.5 rounded-[3px]"
              style={{
                background:
                  price === null
                    ? "var(--sev-none)"
                    : `color-mix(in srgb, var(--sev-3) ${Math.round(share * 100)}%, var(--sev-1))`,
                boxShadow: isBest ? "0 0 0 1.5px var(--foreground)" : undefined,
              }}
            />
            <span
              className={`mt-1 block text-center text-[9px] leading-none ${
                isBest ? "theme-text font-bold" : "theme-subtle"
              }`}
            >
              <span className="sm:hidden">{monthName(month, "narrow")}</span>
              <span className="hidden sm:inline">{monthName(month)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FareCard({
  destination,
  month,
  fare,
  highlighted,
}: {
  destination: FlightDestination;
  month: string;
  fare: FlightFare | undefined;
  highlighted: boolean;
}) {
  if (!fare) {
    return (
      <div className="theme-panel rounded-xl p-3 opacity-60">
        <p className="theme-muted text-xs font-semibold uppercase tracking-wide">{monthLabel(month)}</p>
        <p className="theme-subtle mt-1 text-sm">No cached fare</p>
      </div>
    );
  }

  const dates = `${dayLabel(fare.departureAt)}${fare.returnAt ? ` → ${dayLabel(fare.returnAt)}` : ""}`;
  const stops =
    fare.returnTransfers !== null && fare.returnAt
      ? `${stopsLabel(fare.transfers)} / ${stopsLabel(fare.returnTransfers)}`
      : stopsLabel(fare.transfers);

  return (
    <div
      // Outline, not ring: .theme-panel sets its own box-shadow, which a ring could not override.
      className={`theme-panel overflow-hidden rounded-xl ${
        highlighted ? "outline-2 -outline-offset-1 outline-[color:var(--accent)]" : ""
      }`}
    >
      <a
        href={fare.link}
        target="_blank"
        rel="noreferrer"
        className="block p-3 pb-2 transition-colors hover:bg-[color:var(--accent-soft)]"
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="theme-muted text-xs font-semibold uppercase tracking-wide">{monthLabel(month)}</p>
          <p className="text-base font-semibold">{euro.format(fare.price)}</p>
        </div>
        <p className="mt-1 text-sm">
          {dates}
          {fare.returnAt ? <span className="theme-muted"> · {nightsLabel(fare)}</span> : null}
        </p>
        <p className="theme-subtle mt-0.5 text-xs">
          {[fare.airline, stops, durationLabel(fare.duration)].filter(Boolean).join(" · ")}
        </p>
      </a>
      <p className="theme-subtle flex flex-wrap gap-x-2.5 gap-y-1 px-3 pb-2.5 text-[11px]">
        <span>Same dates on</span>
        {compareLinks(destination, fare).map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
          >
            {link.label}
          </a>
        ))}
      </p>
    </div>
  );
}

function PriceHistory({ values }: { values: number[] }) {
  const [chartRef, size] = useChartSize();

  if (values.length < 2) {
    return (
      <p className="theme-subtle text-xs">
        Price history builds up with every daily crawl.
      </p>
    );
  }
  const data = values.map((price, index) => ({ index, price }));
  return (
    <div ref={chartRef} className="h-16 w-full min-w-0">
      {size.width > 0 && size.height > 0 ? (
        <LineChart
          width={size.width}
          height={size.height}
          data={data}
          margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
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
      ) : null}
    </div>
  );
}

function DestinationRow({
  row,
  months,
  filters,
  open,
  onToggle,
}: {
  row: Row;
  months: string[];
  filters: Filters;
  open: boolean;
  onToggle: () => void;
}) {
  const { destination, best, change, lowestTracked } = row;
  const nights = nightsLabel(best.fare);

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
          <div className="mt-2 max-w-sm">
            <MonthStrip
              destination={destination}
              months={months}
              filters={filters}
              bestMonth={best.month}
            />
          </div>
        </div>

        <div className="flex-none text-right">
          <p className="text-lg font-semibold leading-tight">{euro.format(best.fare.price)}</p>
          <p className="theme-subtle text-xs">
            {monthLabel(best.month)}
            {nights ? ` · ${nights}` : ""}
          </p>
          <p className="theme-subtle text-xs">{stopsLabel(best.fare.transfers)}</p>
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
            {filters.month || filters.stay ? (
              <span className="theme-subtle font-medium normal-case tracking-normal">
                {" "}
                · any month and trip length
              </span>
            ) : null}
          </p>
          <PriceHistory values={row.history} />
          <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
            {months.map((month) => (
              <FareCard
                key={month}
                destination={destination}
                month={month}
                fare={fareFor(destination.months[month], filters.trip, filters.stay)}
                highlighted={month === best.month}
              />
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

  const [trip, setTrip] = useState<FlightTrip>("roundTrip");
  const [region, setRegion] = useState<FlightRegion | "All">("All");
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState<string | null>(null);
  const [stayChoice, setStayChoice] = useState<FlightStay | null>(null);
  const [band, setBand] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("price");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  // A length of stay only exists for round trips; the choice is kept for switching back.
  const stay = trip === "roundTrip" ? stayChoice : null;
  const filters = useMemo<Filters>(() => ({ trip, month, stay }), [trip, month, stay]);

  const allRows = useMemo(() => (data ? buildRows(data, filters) : []), [data, filters]);

  // Everything but the price band, so each band can show how many destinations it holds.
  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allRows.filter(({ destination }) => {
      if (region !== "All" && destination.region !== region) return false;
      if (!needle) return true;
      return [destination.name, destination.country, destination.code].some((value) =>
        value.toLowerCase().includes(needle),
      );
    });
  }, [allRows, region, query]);

  const bandCounts = useMemo(() => {
    const counts = new Array<number>(PRICE_BANDS + 1).fill(0);
    for (const row of matching) counts[priceBand(row.best.fare.price)] += 1;
    return counts;
  }, [matching]);

  const rows = useMemo(() => {
    const filtered =
      band === null ? [...matching] : matching.filter((row) => priceBand(row.best.fare.price) === band);

    return filtered.sort((a, b) => {
      if (sort === "name") return a.destination.name.localeCompare(b.destination.name);
      if (sort === "drop") return (a.change ?? 0) - (b.change ?? 0);
      return a.best.fare.price - b.best.fare.price;
    });
  }, [matching, band, sort]);

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
  const cheapest = rows[0];
  // Trip lengths come from a per-route pass that may not reach every route on a given day.
  const stayRoutes = snapshot.stayRoutes;
  const stayNote = !stay
    ? null
    : !stayRoutes
      ? "Trip lengths have not been crawled yet, so only fares that happen to have this length are listed. The next daily crawl fills them in."
      : stayRoutes.refreshed < stayRoutes.total
        ? `Trip lengths were refreshed for ${stayRoutes.refreshed} of ${stayRoutes.total} route-months in the latest crawl; the rest catch up over the next days, so a few routes may be missing here.`
        : null;
  const selectClass =
    "theme-panel theme-text min-w-0 rounded-full px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:opacity-50";

  function resetPaging() {
    setVisible(PAGE_SIZE);
  }

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
              onClick={() => {
                setTrip(value);
                resetPaging();
              }}
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
              resetPaging();
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
              resetPaging();
            }}
            className={`theme-toggle-option theme-panel flex-none rounded-full px-3 py-1.5 text-xs font-semibold ${
              region === option ? "theme-toggle-option-active" : ""
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <select
          value={month ?? ""}
          onChange={(event) => {
            setMonth(event.target.value || null);
            resetPaging();
          }}
          className={selectClass}
          aria-label="Departure month"
        >
          <option value="">Any month</option>
          {months.map((value) => (
            <option key={value} value={value}>
              {monthLabel(value, "long")}
            </option>
          ))}
        </select>
        <select
          value={stay ?? ""}
          onChange={(event) => {
            setStayChoice((event.target.value || null) as FlightStay | null);
            resetPaging();
          }}
          disabled={trip !== "roundTrip"}
          className={selectClass}
          aria-label="Trip length"
        >
          <option value="">Any trip length</option>
          {FLIGHT_STAYS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={band ?? ""}
          onChange={(event) => {
            setBand(event.target.value === "" ? null : Number(event.target.value));
            resetPaging();
          }}
          className={selectClass}
          aria-label="Price"
        >
          <option value="">Any price</option>
          {bandCounts.map((count, index) =>
            count > 0 || band === index ? (
              <option key={index} value={index}>
                {priceBandLabel(index)} ({count})
              </option>
            ) : null,
          )}
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
        <p className="theme-subtle col-span-2 text-xs sm:ml-auto">
          {rows.length} destinations · {month ? monthLabel(month) : `${monthLabel(months[0])} to ${monthLabel(months[months.length - 1])}`}{" "}
          · updated {crawled}
        </p>
      </div>

      {stayNote ? <p className="theme-subtle text-xs">{stayNote}</p> : null}

      {cheapest && sort === "price" ? (
        <p className="theme-muted text-sm">
          Cheapest right now: <span className="theme-text font-semibold">{cheapest.destination.name}</span> for{" "}
          <span className="theme-text font-semibold">{euro.format(cheapest.best.fare.price)}</span> in{" "}
          {monthLabel(cheapest.best.month)}
          {nightsLabel(cheapest.best.fare) ? `, ${nightsLabel(cheapest.best.fare)}` : ""}.
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
              filters={filters}
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
        not live quotes: check the final price on the booking page, or compare the same dates on Trip.com and
        Google Flights from a fare card. The bars under each destination are the departure months from{" "}
        {monthLabel(months[0], "long")} to {monthLabel(months[months.length - 1], "long")}, coloured from that
        destination&apos;s cheapest month (teal) to its most expensive (orange); grey means no fare, the
        outlined bar is the month of the price shown.
      </p>
    </div>
  );
}
