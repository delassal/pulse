import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { cheapestFares } from "@/lib/flight-utils";
import type {
  FlightDestination,
  FlightFare,
  FlightHistory,
  FlightRegion,
  FlightSnapshot,
} from "@/types";

countries.registerLocale(enLocale);

/**
 * Daily fare crawl for Munich: the cheapest cached fare to every destination,
 * per departure month, for the next 12 months, one-way and round trip.
 *
 * Source: Travelpayouts (Aviasales) Data API. Prices are cached from real user
 * searches, not live quotes, which is why one request can cover a whole month
 * and every destination at once (`unique=true` returns one fare per route).
 * 12 months x 2 trip types = 24 requests per crawl (plus pagination).
 */

export const FLIGHT_ORIGIN = "MUC";
export const FLIGHT_MONTHS_AHEAD = 12;
const HISTORY_MAX_DAYS = 400;

const PRICES_URL = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
const CITIES_URL = "https://api.travelpayouts.com/data/en/cities.json";
const AVIASALES_BASE = "https://www.aviasales.com";
const PAGE_LIMIT = 1000;
const MAX_PAGES = 3;
const CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 25_000;

interface RawFare {
  origin: string;
  destination: string;
  price: number;
  airline?: string;
  departure_at: string;
  return_at?: string | null;
  transfers?: number;
  return_transfers?: number | null;
  duration?: number | null;
  link?: string;
}

interface RawCity {
  code: string;
  name: string | null;
  country_code: string;
  time_zone: string | null;
  name_translations?: { en?: string };
}

interface CityInfo {
  name: string;
  countryCode: string;
  timeZone: string | null;
}

/** First day of the current month and the following months, as YYYY-MM. */
export function upcomingMonths(now = new Date(), count = FLIGHT_MONTHS_AHEAD): string[] {
  const months: string[] = [];
  for (let offset = 0; offset < count; offset++) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    months.push(date.toISOString().slice(0, 7));
  }
  return months;
}

async function fetchFarePage(
  token: string,
  month: string,
  oneWay: boolean,
  page: number,
): Promise<RawFare[]> {
  const params = new URLSearchParams({
    origin: FLIGHT_ORIGIN,
    departure_at: month,
    one_way: String(oneWay),
    unique: "true",
    sorting: "price",
    direct: "false",
    currency: "eur",
    market: process.env.FLIGHTS_MARKET ?? "de",
    limit: String(PAGE_LIMIT),
    page: String(page),
  });

  const response = await fetch(`${PRICES_URL}?${params}`, {
    headers: { "X-Access-Token": token, "Accept-Encoding": "gzip" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Travelpayouts ${month} ${oneWay ? "OW" : "RT"} p${page}: HTTP ${response.status}`);
  }

  const json = (await response.json()) as { success?: boolean; data?: RawFare[]; error?: string };
  if (json.success === false) {
    throw new Error(`Travelpayouts ${month}: ${json.error ?? "request failed"}`);
  }
  return Array.isArray(json.data) ? json.data : [];
}

async function fetchMonth(token: string, month: string, oneWay: boolean): Promise<RawFare[]> {
  const fares: RawFare[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchFarePage(token, month, oneWay, page);
    fares.push(...batch);
    if (batch.length < PAGE_LIMIT) break;
  }
  return fares;
}

async function fetchCities(): Promise<Map<string, CityInfo>> {
  const cities = new Map<string, CityInfo>();
  try {
    const response = await fetch(CITIES_URL, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return cities;
    const raw = (await response.json()) as RawCity[];
    for (const city of raw) {
      cities.set(city.code, {
        name: city.name_translations?.en || city.name || city.code,
        countryCode: city.country_code,
        timeZone: city.time_zone,
      });
    }
  } catch {
    // Names are cosmetic; the crawl still works with bare IATA codes.
  }
  return cities;
}

const MIDDLE_EAST = new Set([
  "AE", "BH", "IL", "IQ", "IR", "JO", "KW", "LB", "OM", "PS", "QA", "SA", "SY", "YE",
]);
const EUROPE_EXTRA = new Set(["CY", "TR", "IS", "PT", "ES", "FO", "GB", "IE", "RU"]);
const AFRICA_EXTRA = new Set(["CV", "MU", "SC", "RE", "MG", "KM", "YT", "ST"]);
const AMERICAS_EXTRA = new Set(["BM"]);

function regionFor(countryCode: string, timeZone: string | null): FlightRegion {
  if (MIDDLE_EAST.has(countryCode)) return "Middle East";
  if (EUROPE_EXTRA.has(countryCode)) return "Europe";
  if (AFRICA_EXTRA.has(countryCode)) return "Africa";
  if (AMERICAS_EXTRA.has(countryCode)) return "Americas";

  const zone = timeZone?.split("/")[0];
  switch (zone) {
    case "Europe":
      return "Europe";
    case "Africa":
      return "Africa";
    case "America":
      return "Americas";
    case "Australia":
    case "Pacific":
      return "Oceania";
    default:
      return "Asia";
  }
}

function normalizeFare(raw: RawFare, oneWay: boolean): FlightFare {
  const returnTrip = !oneWay && raw.return_at ? raw.return_at : null;
  return {
    price: Math.round(raw.price),
    departureAt: raw.departure_at,
    returnAt: returnTrip,
    airline: raw.airline ?? "",
    transfers: raw.transfers ?? 0,
    returnTransfers: returnTrip ? (raw.return_transfers ?? null) : null,
    duration: raw.duration ?? null,
    link: raw.link ? `${AVIASALES_BASE}${raw.link}` : AVIASALES_BASE,
  };
}

/** Runs async jobs with a fixed number of workers so we stay polite to the API. */
async function runPool<T>(jobs: Array<() => Promise<T>>, concurrency: number) {
  const results: Array<PromiseSettledResult<T>> = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await jobs[index]() };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return results;
}

export { cheapestFares };

export async function crawlFlights(token: string, now = new Date()): Promise<{
  snapshot: FlightSnapshot;
  errors: string[];
}> {
  const months = upcomingMonths(now);
  const tasks = months.flatMap((month) =>
    [true, false].map((oneWay) => ({ month, oneWay })),
  );

  const [cities, results] = await Promise.all([
    fetchCities(),
    runPool(
      tasks.map(({ month, oneWay }) => () => fetchMonth(token, month, oneWay)),
      CONCURRENCY,
    ),
  ]);

  const destinations: Record<string, FlightDestination> = {};
  const errors: string[] = [];

  results.forEach((result, index) => {
    const { month, oneWay } = tasks[index];
    if (result.status === "rejected") {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
      return;
    }

    for (const raw of result.value) {
      if (!raw.destination || !Number.isFinite(raw.price) || raw.price <= 0) continue;
      // The API can return fares whose date drifted outside the requested month.
      if (!raw.departure_at?.startsWith(month)) continue;

      const code = raw.destination;
      let destination = destinations[code];
      if (!destination) {
        const city = cities.get(code);
        const countryCode = city?.countryCode ?? "";
        destination = {
          code,
          name: city?.name ?? code,
          country: (countryCode && countries.getName(countryCode, "en")) || countryCode,
          countryCode,
          region: regionFor(countryCode, city?.timeZone ?? null),
          months: {},
        };
        destinations[code] = destination;
      }

      const slot = (destination.months[month] ??= {});
      const key = oneWay ? "oneWay" : "roundTrip";
      const fare = normalizeFare(raw, oneWay);
      const existing = slot[key];
      if (!existing || fare.price < existing.price) {
        slot[key] = fare;
      }
    }
  });

  return {
    snapshot: {
      origin: FLIGHT_ORIGIN,
      currency: "EUR",
      crawledAt: now.toISOString(),
      months,
      requests: tasks.length,
      failedRequests: errors.length,
      destinations,
    },
    errors,
  };
}

/** Appends (or replaces) today's row in the long-running price history. */
export function appendHistory(
  history: FlightHistory | null,
  snapshot: FlightSnapshot,
): FlightHistory {
  const day = snapshot.crawledAt.slice(0, 10);
  const next: FlightHistory = history
    ? { days: [...history.days], series: { ...history.series } }
    : { days: [], series: {} };

  let dayIndex = next.days.indexOf(day);
  if (dayIndex === -1) {
    next.days.push(day);
    dayIndex = next.days.length - 1;
  }

  const width = next.days.length;
  const codes = new Set([...Object.keys(next.series), ...Object.keys(snapshot.destinations)]);

  for (const code of codes) {
    const row = [...(next.series[code] ?? [])];
    while (row.length < width) row.push([null, null]);

    const destination = snapshot.destinations[code];
    if (destination) {
      const cheapest = cheapestFares(destination);
      row[dayIndex] = [cheapest.oneWay?.fare.price ?? null, cheapest.roundTrip?.fare.price ?? null];
    } else {
      row[dayIndex] = [null, null];
    }
    next.series[code] = row;
  }

  // Keep the file bounded: drop the oldest days beyond the retention window.
  const overflow = next.days.length - HISTORY_MAX_DAYS;
  if (overflow > 0) {
    next.days = next.days.slice(overflow);
    for (const code of Object.keys(next.series)) {
      const row = next.series[code].slice(overflow);
      if (row.every(([ow, rt]) => ow === null && rt === null)) {
        delete next.series[code];
      } else {
        next.series[code] = row;
      }
    }
  }

  return next;
}
